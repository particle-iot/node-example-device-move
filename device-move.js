const fs = require('fs');
const path = require('path');
const axios = require('axios');

(function(deviceMove) {

    deviceMove.setup = function(helper) {

        helper.getDevicesToMoveList = async function(productId, opts) {
            // productId can be 0 or undefined for sandbox
            let deviceList = [];
    
            let data = [];
    
            if (productId) {
                data.push([
                    'Device ID',
                    'Device Name',
                    'Online',
                    'Owner',
                    'Groups'
                ]);
    
                for(let page = 1; ; page++) {
                    try {
                        const resp = await axios({
                            headers: {
                                'Authorization': 'Bearer ' + helper.auth,
                                'Accept': 'application/json'
                            },
                            method: 'get',
                            params: {
                                page
                            },
                            transformResponse: data => JSON.parse(data),
                            url: 'https://api.particle.io/v1/products/' + productId + '/devices'
                        });
                        for(const device of resp.data.devices) {
                            deviceList.push(device);
                            data.push([
                                device.id,
                                device.name ? device.name : '',
                                device.online ? 'Y' : 'N',
                                device.owner ? device.owner : '',
                                device.groups ? device.groups.join(' ') : ''
                            ]);
                        }
                        if (page >= resp.data.meta.total_pages) {
                            break;
                        }
                    }
                    catch(e) {                    
                        console.log('Unexpected error retrieving product device list ' + e.statusText, e.data);
                        return {error: true, errorText: e.statusText};
                    }         
    
                }
            }
            else {
                data.push([
                    'Device ID',
                    'Device Name',
                    'Online'
                ]);
    
                try {
                    const resp = await axios({
                        headers: {
                            'Authorization': 'Bearer ' + helper.auth,
                            'Accept': 'application/json'
                        },
                        method: 'get',
                        transformResponse: data => JSON.parse(data),
                        url: 'https://api.particle.io/v1/devices'
                    });
        
                    for(const device of resp.data) {
                        if (device.platform_id != device.product_id) {
                            // A product device, ignore
                            continue;
                        }
                        if (device.platform_id != opts.platformId) {
                            continue;
                        }
                        deviceList.push(device);
    
                        data.push([
                            device.id,
                            device.name ? device.name : '',
                            device.online ? 'Y' : 'N'
                        ]);
                    }
                }
                catch(e) {                    
                    console.log('e', e);
                    console.log('Unexpected error retrieving sandbox device list ' + e.statusText, e.data);
                    return {error: true, errorText: e.statusText};
                }         
        
            }
            if (deviceList.length == 0) {
                const err = 'There are no devices that can be moved';
                console.log(err);
                return {error: true, errorText: err};
            }
    
            // console.log('deviceList', deviceList);
            const deviceListText = helper.formatOutput(data);
    
            console.log('There are ' + deviceList.length + ' devices that can be moved.');
            console.log('To move a subset of devices, edit the devices.txt file, removing the lines for');
            console.log('any devices that you want to keep in the product and not move.')
    
            const devicesFilePath = path.join(helper.rootDir, 'devices.txt');
            fs.writeFileSync(devicesFilePath, deviceListText);
    
            await helper.questionContinueQuit('Have you edited the devices.txt file and are you ready to proceed?');
    
            let devicesToMove = [];
            let hasOfflineDevices = false;
    
            while(true) {
                let includeDeviceId = {};
        
                {
                    const re = /^([A-Fa-f0-9]{24})/;
        
                    for(const line of fs.readFileSync(devicesFilePath, 'utf8').split('\n')) {
                        const m = line.match(re);
                        if (m) {
                            includeDeviceId[m[1]] = true;
                        }
                    }    
                    // console.log('includeDeviceId', includeDeviceId);
                }
                
        
                let devicesToMoveData = [];
                devicesToMoveData.push([
                    'Device ID',
                    'Device Name',
                ]);
        
                hasOfflineDevices = false;
                devicesToMove = [];
    
                for(const device of deviceList) {
                    if (includeDeviceId[device.id]) {
                        devicesToMove.push(device);
        
                        devicesToMoveData.push([
                            device.id,
                            device.name ? device.name : ''
                        ]);
        
                        if (!device.online) {
                            hasOfflineDevices = true;
                        }
                    }
                }
        
                if (devicesToMove.length == 0) {
                    console.log('There are no selected devices to move, canceling');
                    return {cancel: true};
                }
        
                console.log('You have selected ' + devicesToMove.length + ' devices to move');
                console.log(helper.formatOutput(devicesToMoveData))
        
                if (await helper.questionYN('Continue with this selection (y) or check devices.txt again (n)?')) {
                    break;
                }
            }

            if (config.removeDevicesFile) {
                fs.rmSync(devicesFilePath);
            }

            return {
                deviceList: devicesToMove,
                hasOfflineDevices
            };
    
        };
    
    
        helper.checkForCustomers = async function(productId, deviceList) {
            let devicesWithCustomers = [];
    
            for(let page = 1; ; page++) {
                try {
                    const resp = await axios({
                        headers: {
                            'Authorization': 'Bearer ' + helper.auth,
                            'Accept': 'application/json'
                        },
                        method: 'get',
                        params: {
                            page
                        },
                        transformResponse: data => JSON.parse(data),
                        url: 'https://api.particle.io/v1/products/' + productId + '/customers'
                    });
    
                    for(const customer of resp.data.customers) {
                        for(const d1 of customer.devices) {
                            for(const d2 of deviceList) {
                                if (d1 == d2.id) {
                                    devicesWithCustomers.push(d2);   
                                }
                            }
                        }
                    }
                    if (page >= resp.data.meta.total_pages) {
                        break;
                    }
                }
                catch(e) {                    
                    console.log('Unexpected error retrieving customer list', e);
                    return {error: true, errorText: e.statusText};
                }         
    
            }
    
            if (devicesWithCustomers.length) {
                console.log('You have selected ' + devicesWithCustomers.length + ' devices that are using customer claiming.');
                console.log('Customers cannot be moved between products, and their access tokens will no longer work.');
                console.log('Customer devices will be unclaimed after moving, and this will likely disrupt service for ');
                console.log('those devices until manually reconfigured.');
    
                if (!await helper.questionYN('Are you sure you want to move these devices?')) {
                    process.exit(1);
                }
            
            }
        };
    
    
        helper.moveDevices = async function(sourceProduct, destProduct, deviceList) {
            for(const device of deviceList) {
                try {
                    if (!sourceProduct.sandbox) {
                        // Remove from old product
                        try {
                            const resp = await axios({
                                headers: {
                                    'Authorization': 'Bearer ' + helper.auth
                                },
                                method: 'delete',
                                url: 'https://api.particle.io/v1/products/' + sourceProduct.id + '/devices/' + device.id
                            });    
                            console.log('Removing ' + device.id + ' from ' + sourceProduct.id + ' succeeded');
                        }
                        catch(e) {
                            //console.log('exception', e);
                            console.log('Removing ' + device.id + ' failed ' + e.statusText, e.data);
                        }
    
                    }
    
                    {
                        // Add device into product
                        try {
                            const postBodyObj = {
                                id: device.id,
                                import_sims: true
                            };
    
                            const resp = await axios({
                                data: new URLSearchParams(postBodyObj).toString(),
                                headers: {
                                    'Authorization': 'Bearer ' + helper.auth,
                                    'Accept': 'application/json'
                                },
                                method: 'post',
                                transformResponse: data => JSON.parse(data),
                                url: 'https://api.particle.io/v1/products/' + destProduct.id + '/devices'
                            });
            
                            console.log('Adding ' + device.id + ' to ' + destProduct.id + ' succeeded');
                        }
                        catch(e) {
                            //console.log('exception', e);
                            console.log('Adding ' + device.id + ' failed ' + e.statusText, e.data);
                        }
                    }
    
                    // Add SIM to product?                
                    
                }
                catch(e) {
                    console.log('exception moving device', e);
                }
            }
        };
    

    };

}(module.exports));


