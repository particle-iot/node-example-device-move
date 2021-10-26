const fs = require('fs');
const path = require('path');

const axios = require('axios');

let config = require('./config');

const deviceMove = require('./device-move');

const helper = require('@particle/node-example-helper');
helper
    .withRootDir(__dirname)
    .withConfig(config);

deviceMove
    .withConfig(config)
    .setup(helper);
 
async function run() {
    console.log('Moving devices into a product may affect billing and typically requires that ');
    console.log('new firmware be flashed to the device. It may also require a Device OS update');
    console.log('on some devices. Devices may be offline for a period of time while moving');
    console.log('devices.');
    console.log('');
    console.log('If you are migrating to growth you should instead move entire products into');
    console.log('your organization which is non-disruptive in most cases and significantly less');
    console.log('dangerous.');
    await helper.questionContinueQuit('Do you want to continue?');
    
    await helper.authenticate();

    // These things can be configured in config.js or can be entered interactively

    console.log('Select the destination product to move devices to');

    const destProduct = await helper.promptForProduct({
        allowSandbox: false,
        prompt: 'Move devices to'
    });
    if (destProduct.cancel || destProduct.error) {
        process.exit(1);
    }

    console.log('Destination is a ' + destProduct.platformName + ' product.')

    const sourceProduct = await helper.promptForProduct({
        allowSandbox: true,
        platformId: destProduct.platform_id,
        notProductId: destProduct.id,
        prompt: 'Move devices from'
    });
    if (sourceProduct.cancel || sourceProduct.error) {
        process.exit(1);
    }

    console.log('');
    if (sourceProduct.sandbox) {
        console.log('Moving devices from developer sandbox');
    }
    else {
        // Check to make sure quarantine is turned on in the source product?

        console.log('Moving devices from product ' + sourceProduct.id + ' (' + sourceProduct.name + ')');
    }
    console.log('to product ' + destProduct.id + ' (' + destProduct.name + ') containing ' + destProduct.platformName + ' devices');

    console.log('');

    const deviceListResp = await helper.getDevicesToMoveList(sourceProduct.sandbox ? 0 : sourceProduct.id, {
        platformId: destProduct.platform_id
    });

    if (!deviceListResp.deviceList) {
        process.exit(1);
    }
    console.log('')
    console.log('Moving devices can affect billing, data usage, and devices may go offline for a period of time.')


    console.log('')

    if (!sourceProduct.sandbox) {
        await helper.checkForCustomers(sourceProduct.id, deviceListResp.deviceList);
    }

    if (deviceListResp.hasOfflineDevices) {
        if (!sourceProduct.sandbox) {
            if (!sourceProduct.settings.quarantine) {
                console.log('Your source product ' + sourceProduct.id + ' (' + sourceProduct.name + ') has quarantine');
                console.log('disabled, and you are moving offline devices. You must either make sure quarantine is enabled');
                console.log('or make sure all devices are online, or the offline devices will not move.');    
            }
            else {
                console.log('You are moving product devices that are offline. They may not completely move until the ');
                console.log('next time they connect to the cloud.');
            }
        }  
    }

    if (!await helper.questionYN('Are you sure you want to proceed with moving devices?')) {
        process.exit(1);
    }
    
    await helper.moveDevices(sourceProduct, destProduct, deviceListResp.deviceList);
    
    console.log('Move complete!');

    helper.close();
}


run();
