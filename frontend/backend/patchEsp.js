const fs = require('fs');

let code = fs.readFileSync('CANSAT_Central_Telemetry.ino', 'utf8');

// 1. Add PubSubClient include
if (!code.includes('#include <PubSubClient.h>')) {
    code = code.replace(
        '#include <ESP8266HTTPClient.h>',
        '#include <ESP8266HTTPClient.h>\n#include <PubSubClient.h>'
    );
}

// 2. Add MQTT configuration right after CENTRAL_API_URL
if (!code.includes('MQTT_HOST')) {
    code = code.replace(
        'const char *CENTRAL_API_URL =',
        'const char *MQTT_HOST =\n    "192.168.137.1";\n\nconst int MQTT_PORT =\n    1883;\n\nconst char *CENTRAL_API_URL ='
    );
}

// 3. Declare PubSubClient
if (!code.includes('PubSubClient mqttClient')) {
    code = code.replace(
        '// ==============================================================================\n// [NETWORK / LOCATION]',
        'WiFiClient mqttWiFiClient;\nPubSubClient mqttClient(mqttWiFiClient);\n\n// ==============================================================================\n// [NETWORK / LOCATION]'
    );
}

// 4. Setup MQTT in setup()
if (!code.includes('mqttClient.setServer')) {
    code = code.replace(
        'Serial.println("Wi-Fi connected.");',
        'Serial.println("Wi-Fi connected.");\n\n  mqttClient.setServer(MQTT_HOST, MQTT_PORT);\n  mqttClient.setBufferSize(1024);'
    );
}

// 5. Handle reconnect and publish in sendTelemetryToCentralAPI
const sendTelemetryRegex = /void sendTelemetryToCentralAPI\(\) \{[\s\S]*?\/\*\n     \* ============================================================================\n     \* LOCAL HTTP/m;

const newSendTelemetry = `void sendTelemetryToCentralAPI() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  String payload =
      generateTelemetryJSON();

  if (payload.length() == 0) {
    return;
  }

  // Ensure MQTT connection
  if (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    if (mqttClient.connect(SATELLITE_ID, SATELLITE_ID, FLEET_API_KEY)) {
      Serial.println(" connected.");
    } else {
      Serial.print(" failed, rc=");
      Serial.println(mqttClient.state());
      return;
    }
  }

  String topic = String("telemetry/") + SATELLITE_ID;
  
  if (mqttClient.publish(topic.c_str(), payload.c_str())) {
      Serial.println("Telemetry MQTT publish success.");
  } else {
      Serial.println("Telemetry MQTT publish failed.");
  }
}

/*
     * ============================================================================
     * LOCAL HTTP`;

code = code.replace(
    /void sendTelemetryToCentralAPI\(\)\s*\{[\s\S]*?(?=\/\*\n\s*\* ============================================================================\n\s*\* LOCAL HTTP)/,
    newSendTelemetry + "\n\n  "
);

// 6. Call mqttClient.loop() in loop()
if (!code.includes('mqttClient.loop()')) {
    code = code.replace(
        'dnsServer.processNextRequest();',
        'dnsServer.processNextRequest();\n\n  if (mqttClient.connected()) {\n    mqttClient.loop();\n  }'
    );
}

fs.writeFileSync('CANSAT_Central_Telemetry.ino', code);
console.log("ESP code patched successfully.");

