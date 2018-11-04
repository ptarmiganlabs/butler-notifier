

exports.mqttInitHandlers = function (mqttClient, logger, config) {
    // Handler for MQTT connect messages. Called when connection to MQTT broker has been established
    mqttClient.on('connect', function () {
        logger.info(`Connected to MQTT server ${config.get('mqttConfig.brokerHost')}:${config.get('mqttConfig.brokerPort')}, with client ID ${mqttClient.options.clientId}`);

        // Let the world know that the Qlik Sense notification gateway is connected to MQTT
        mqttClient.publish('qliksense/event/status', 'Notification gateway connected to MQTT broker ' + config.get('mqttConfig.brokerHost') + ':' + config.get('mqttConfig.brokerPort') + ' with client ID ' + mqttClient.options.clientId);
    });


    // Handler for MQTT messages matching the previously set up subscription
    // Note: At time of this writing, this program does not itself subscribe to any MQTT topics. This function is thus just a placeholder for future use.
    mqttClient.on('message', function (topic, message) {
        logger.verbose('MQTT message received');
        logger.debug(topic.toString());
        logger.debug(message.toString());
    });


    // Handler for MQTT errors
    mqttClient.on('error', function (topic, message) {
        // Error occured
        logger.error('MQTT error: ' + message);
    });
};