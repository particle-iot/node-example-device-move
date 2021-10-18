
(function(config) {
	// Setting an auth token here is optional. If you do not set the auth token
    // here, you'll be prompted for it interactively, which is more secure.
    // config.auth = 'xxxx';

    // If you prompt for the authentication code, this is how long the token
    // should be valid in seconds. 3600 = 1 hour
    config.authTokenLifeSecs = 3600;

    // If you are using interactive login, you can temporarily save the token
    // in the settings.json file so you don't have to log in every time you
    // run the tool.
    config.saveInteractiveToken = false;

    // Remove devices.txt file after reading reading it. This is useful on the 
    // web-based version to make sure you don't leave a list of Device IDs 
    // in your project if you are using a free account where the projects
    // are public.
    config.removeDevicesFile = true;

}(module.exports));


