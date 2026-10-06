import mqtt, { MqttClient } from 'mqtt';

const brokerUrl = 'mqtt://mqtt-dashboard.com:1883'; //Broker URL te vervangen later

const options = {
    clientId: `brouw_backend_${Math.random().toString(16).substr(2, 8)}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
};

//VERBINDING STARTEN
const mqttClient: MqttClient = mqtt.connect(brokerUrl, options);

//ABBONEREN OP TOPIC
mqttClient.on('connect', () => {
    console.log('Successfully connected to MQTT broker');
    const topicToSubscribe = [
        'brouwer/+/sensor/+',         
        'brouwer/+/actuator/+/state',   
        'brouwer/+/status'  
    ]; 

    mqttClient.subscribe(topicToSubscribe, (err: Error | null) => {
        if (!err) {
            console.log(`Subscribed to topic: ${topicToSubscribe}`);
        }
        else{
            console.error(`Error subscribing to topic: ${topicToSubscribe}`, err);
        }
    }
    )
});

//DATA ONTVANGEN
mqttClient.on('message', (topic: string, message: Buffer) => {
    const payload = message.toString();

    console.log(`Received message on topic: ${topic} with payload: ${payload}`);

    const pathSegments = topic.split('/'); 
    const brouwerId = pathSegments[1];    
    const hoofdtype = pathSegments[2];     

    if (hoofdtype === 'sensor') {
        const sensorType = pathSegments[3]; 
        console.log(`[SENSOR] Brouwer #${brouwerId} stuurt ${sensorType}: ${payload}`);
        // DATABASE UPDATE LATER: Sla deze specifieke meting op
    } 
    
    else if (hoofdtype === 'actuator') {
        const actuatorNaam = pathSegments[3]; 
        console.log(`[ACTUATOR] Brouwer #${brouwerId} meldt toestand van ${actuatorNaam}: ${payload}`);
        // DATABASE UPDATE LATER: Update de huidige status van de actuator
    } 
    
    else if (hoofdtype === 'status') {
        console.log(`[STATUS] Brouwer #${brouwerId} is nu: ${payload}`);
        // DATABASE LATER: Update of de controller online of offline is
    } 
});

//FOUTAFHANDELING
mqttClient.on('error', (err: Error) => {
    console.error('MQTT client error:', err);
});

export default mqttClient;



