const fs = require('fs');
var mqtt = require('mqtt');
var config = require('config');
var yaml = require('js-yaml');
var winston = require('winston');
var qrsInteract = require('qrs-interact');


const express = require('express');
const bodyParser = require('body-parser');


// Get app version from package.json file
var appVersion = require('./package.json').version;

// Initialize MQTT
const mqttInitHandlers = require('./mqtt_handlers').mqttInitHandlers;


// Set up Winston logger, logging both to console and different disk files
const logTransports = {
    console: new winston.transports.Console({
        name: 'console_log',
        level: config.get('defaultLogLevel'),
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
        )
    }),
    f_info: new winston.transports.File({
        name: 'file_info',
        filename: config.get('logDirectory') + '/info.log',
        level: 'info'
    }),
    f_verbose: new winston.transports.File({
        name: 'file_verbose',
        filename: config.get('logDirectory') + '/verbose.log',
        level: 'verbose'
    }),
    f_debug: new winston.transports.File({
        name: 'file_debug',
        filename: config.get('logDirectory') + '/debug.log',
        level: 'debug'
    }),
    f_error: new winston.transports.File({
        name: 'file_error',
        filename: config.get('logDirectory') + '/error.log',
        level: 'error'
    })
};

var logger = winston.createLogger({
    transports: [
        logTransports.console,
        logTransports.f_info,
        logTransports.f_verbose,
        logTransports.f_debug,
        logTransports.f_error
    ],
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    )
});

// Startup message
logger.info('Starting Qlik Sense notifications to MQTT gateway.');
logger.info("Log level is: " + logTransports.console.level);


// ------------------------------------
// Create MQTT client object and connect to MQTT broker
var mqttClient = mqtt.connect({
    port: config.get("mqttConfig.brokerPort"),
    host: config.get("mqttConfig.brokerHost")
});

/*
  Following might be needed for conecting to older Mosquitto versions
  var mqttClient  = mqtt.connect('mqtt://<IP of MQTT server>', {
    protocolId: 'MQIsdp',
    protocolVersion: 3
  });
*/

// ---------------------------------------------------
// Set up MQTT
mqttInitHandlers(mqttClient, logger, config);



// Set up Sense repository service configuration
var configQRS = {
    hostname: config.get('qrs.host'),
    certificates: {
        certFile: config.get('qrs.clientCertPath'),
        keyFile: config.get('qrs.clientCertKeyPath'),
    },
    headers: {
        'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_repository',
        'Content-Type': 'application/json'
    }
}
var qrsInteractInstance = new qrsInteract(configQRS);


// ---------------------------------------------------
// Create app object
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


// Load info in YAML file on what Sense notifications to monitor (and thus set up callback URLs for)
try {
    var notifConfigYaml = fs.readFileSync('./config/notification.yaml', 'utf8');
    var notifConfigDoc = yaml.safeLoad(notifConfigYaml);

    const callbackBaseURL = config.get('callbackHost.baseURL') + ':' + config.get('callbackHost.serverPort');
    logger.debug(`Callback base URL: ${callbackBaseURL}`);

    // Loop over all entries in notifications config file
    notifConfigDoc.notifications.forEach(function (notifConfig) {

        // Add callback endpoint that QRS will call when notifications occur
        app.post('/' + notifConfig.callbackEndpointName, function (req, res) {
            logger.verbose(`Received callback to endpoint: ${req.url}`);

            if (req.body.length > 0) {

                logger.debug(`Notification data: ${JSON.stringify(req.body[0], null, 2)}`)

                // The callback does not contain any details on what happened, but it does provide an ID through
                // which the details can be retrieved. 
                // Note that QRS sends an array of events to the callback URL, we need to iterate through all of them

                logger.debug(`Number of events in callback: ${req.body.length}`);

                // Get event details from QRS
                req.body.forEach(function (event) {
                    logger.debug(`Retrieving event details for ID: ${event.objectID}`);

                    let qrs = new qrsInteract(configQRS);

                    qrs.Get(`${event.objectType}/${event.objectID}`)
                        .then(result => {
                            logger.verbose(`Successfully retrieved event details.`)
                            logger.debug(`Event details: ${JSON.stringify(result, null, 2)}`);

                            // Post to different MQTT topics depending on what event was received
                            if (event.objectType.toLowerCase() == 'executionresult') {
                                // Post to MQTT topic qliksense/notification/executionResult/<app ID>/<task ID>/lastKnownStatus
                                // This is a task's most recent reported reload status (triggered, queued, running, failed etc). 
                                mqttClient.publish(`qliksense/notification/executionResult/${result.body.appID}/${result.body.taskID}/lastKnownStatus`, JSON.stringify(result.body.status));

                                // Post to MQTT topic qliksense/notification/executionResult/<app ID>/<task ID>/lastKnownFullState
                                // This is a task's most recent, complete reload state. This is a fairly large JSON.
                                mqttClient.publish(`qliksense/notification/executionResult/${result.body.appID}/${result.body.taskID}/lastKnownFullState`, JSON.stringify(result.body));

                                // Post to MQTT topic qliksense/notification/executionResult/<app ID>/<task ID>/<execution result code>
                                // This is the complete reload state, published to a topic specific for the result code
                                mqttClient.publish(`qliksense/notification/executionResult/${result.body.appID}/${result.body.taskID}/${result.body.status}`, JSON.stringify(result.body));
                            } else if (event.objectType.toLowerCase() == 'user') {
                                // Post to MQTT topic qliksense/notification/user/<user directory>/<user ID>/lastKnownFullState
                                mqttClient.publish(`qliksense/notification/user/${result.body.userDirectory}/${result.body.userID}/lastKnownFullState`, JSON.stringify(result.body));

                                // Post to MQTT topic qliksense/notification/user/lastMessage
                                mqttClient.publish(`qliksense/notification/user/lastMessage`, JSON.stringify(result.body));
                            } else if (event.objectType.toLowerCase() == 'app') {
                                // // Post to MQTT topic qliksense/notification/app/<app ID>/lastKnownFullState
                                // mqttClient.publish(`qliksense/notification/app/${result.body.appID}/lastKnownFullState`, JSON.stringify(result.body));

                                // // Post to MQTT topic qliksense/notification/app/lastMessage
                                // mqttClient.publish(`qliksense/notification/app/lastMessage`, JSON.stringify(result.body));
                            }

                        })
                        .catch(err => {
                            logger.warn(`Error while getting event details from QRS: ${err}. If the event was a delete, this warning is expected behaviour.`);
                        })
                });
            }

            res.json('Ok');
        });

        // Register notification with QRS
        var callbackURL = callbackBaseURL + '/' + notifConfig.callbackEndpointName;
        logger.debug(`Posting to QRS endpoint: notification?&name=${notifConfig.typeName}`);
        logger.debug(`Body of QRS call       : ${callbackURL}`);

        // Build a URL with all parameters set up in the notification.yaml file
        var qrsURL = `notification?name=${notifConfig.typeName}`;
        if (notifConfig.id != null) qrsURL += `&id=${notifConfig.id}`;
        if (notifConfig.filter != null) qrsURL += `&filter=${notifConfig.filter}`;
        if (notifConfig.condition) qrsURL += `&condition=${notifConfig.condition}`;
        if (notifConfig.changeType) qrsURL += `&changeType=${notifConfig.changeType}`;
        if (notifConfig.propertyName) qrsURL += `&propertyName=${notifConfig.propertyName}`;

        logger.debug(`URL used to set up notifiaction: ${qrsURL}`);

        qrsInteractInstance.Post(qrsURL, callbackURL, 'json')
            .then(result => {
                logger.info(`Successfully registered notification for event type: ${notifConfig.typeName}`)
                logger.verbose(`   Result code        : ${result.statusCode}`);
                logger.verbose(`   Notification handle: ${result.body.value}`);
            })
            .catch(err => {
                logger.error(`Error while setting up notification in QRS: ${err}`);
            })

    }, this);

} catch (e) {
    logger.log('error', 'Error while reading notifications config data: ' + e)
}


// ---------------------------------------------------
// Start REST server
app.listen(config.get('callbackHost.serverPort'), function () {
    logger.log('info', `REST server now listening on ${config.get('callbackHost.serverPort')}`);
});