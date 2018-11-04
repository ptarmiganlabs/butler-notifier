# Qliksense notification to MQTT gateway

Forwarding Qlik Sense event notifications to MQTT messages

    ==> Work in progress <==
    This project is in pre-release state.
    Some features are not ready and/or optimized.

    Feel free to fork the project and contribute to the development!

## Rationale

Qlik Sense offers a very powerful, but somewhat hard to use [notification API](https://help.qlik.com/en-US/sense-developer/September2018/Subsystems/RepositoryServiceAPI/Content/Sense_RepositoryServiceAPI/RepositoryServiceAPI-Notification-Create-Change-Subscription.htm).

Through this API you can get notified when all kinds of events happen in a Sense environment.
The API is in fact extremely rich, you can get notified when almost *anything* happens...
Notifications examples include

* Task failures
* Reload task progress
* Apps being published, updated or deleted
* Sheets being updated
* The details of a specific user are changed
* ...

This is all good, except that the notification API is somewhat hard to get started with and use.
You need to set up some kind of authentication to QRS, set up a REST server which QRS can call/notify when the subscribed to events occur, you also need to register callbacks for all QRS events you are interested in etc.

Fine if you have a well defined project that you want to create an optimized program for, but somwhat of a pain if you just want to try out the Qlik Sense notification features.

The application in this project makes it vastly easier to set up and use Qlik Sense notifications in both prototype and production contexts:

* All configuration is done in YAML config files
  * One file defines QRS specific parameters like certificates, IP addresses of the QRS server etc
  * One file defines what QRS events to subscribe to
* The application handles everything around setting up callbacks that QRS will use to notify about the subscribed to events
* All events are forwarded as MQTT messages, which can be acted upon by downstream services.

Running the gateway and having it subscribe to reload task events looks like this:

![reload-task-verbose.png](doc/img/reload-task-verbose.png "Running the gateway")

Setting the debug level to 'debug' will greatly increase the information logged to console and disk log files.

## The config files

Both config files are in YAML, which makes them easy to read and understand.
Event subscriptions are defined in notification.yaml, which can look like this:

![notification.yaml](doc/img/notification-yaml.png "Setting up event subscriptions")

The file where more general settings are defined looks like this:

![development.template.yaml](doc/img/development-template-yaml.png "Main config file")

## What is MQTT

[MQTT](https://en.wikipedia.org/wiki/MQTT) is a machine-to-machine messaging protocol. It is widely used in Internet of Things applications, but works equally well for server based messaging.

By *publishing* the QRS events as MQTT *messages* in well defined *topics*, other applications or services can then *subscribe* to the topics of interest, and be notified in real time when new messages arrive.
MQTT thus uses a "publish-subscribe", or pub-sub concept.

In order to use MQTT an "MQTT broker" is needed. [Mosquitto](https://mosquitto.org/) is a good open source option - it has been around for some years and is mature and stable.

A good intro to MQTT is found [here](https://www.hivemq.com/blog/how-to-get-started-with-mqtt).

## Using MQTT messages

There are lots of good client side libraries for MQTT, making it easy to use the MQTT messages (or rather the QRS events!) in your applications.

### Node-RED

A great way to get started is to use [Node-RED](https://nodered.org/), which is an open source visual development environment with great MQTT support.
While Node-RED is promoted as a prototyping tool for IoT applications, it is very stable and lots of people use it in prodcution settings. But as always - try these things in a sandbox/lab environment before deploying into production environments.

## Links and references

* The [QRS help pages](https://help.qlik.com/en-US/sense-developer/September2018/Subsystems/RepositoryServiceAPI/Content/Sense_RepositoryServiceAPI/RepositoryServiceAPI-Notification-Create-Change-Subscription.htm) provide info on the syntax used to define what QRS events to subscribe to
* The fine folks in Qlik's enterprise architecture team has a good [blog post](https://eablog.qlikpoc.com/2018/11/01/qlik-sense-repository-notification-api/) describing the concepts of the notification API, including some good examples. Highly recommended reading.
