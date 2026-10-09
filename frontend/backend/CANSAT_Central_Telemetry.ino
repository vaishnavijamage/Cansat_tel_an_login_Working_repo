/*
 * ====================================================================================
 * PROJECT ANTRIKSHA: CANSAT V5
 * CENTRAL TELEMETRY API VERSION
 * ====================================================================================
 *
 * Student-configurable values:
 *   1. SATELLITE_ID
 *   2. CENTRAL_API_URL
 *   3. FLEET_API_KEY
 *
 * The ESP8266 automatically handles:
 *   - Wi-Fi connection through WiFiManager
 *   - sensor readings
 *   - timestamp generation
 *   - telemetry JSON creation
 *   - sending telemetry to the Central API
 *
 * The backend handles:
 *   - authentication
 *   - validation
 *   - duplicate detection
 *   - Redis
 *   - MySQL
 *   - latest-state storage
 *
 * NOTE:
 * HTTPS setInsecure() is used only for development/staging.
 * Proper CA certificate validation must be added before production.
 */

// Include the massive HTML file from a separate tab to keep this file clean
#include "index.h"

// Sensor libraries
#include <Adafruit_BMP280.h>
#include <DHT.h>

// Storage
#include <EEPROM.h>
#include <LittleFS.h>

// Networking
#include <ESP8266HTTPClient.h>
#include <PubSubClient.h>
#include <ESP8266WebServer.h>
#include <WebSocketsServer.h>
#include <ESP8266mDNS.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <WiFiUdp.h>

// GPS / serial
#include <SoftwareSerial.h>
#include <TinyGPSPlus.h>

// I2C / time
#include <Wire.h>
#include <time.h>


// ==============================================================================
// [FIRMWARE CONFIGURATION]
// ==============================================================================

/*
 * Wi-Fi setup hotspot name.
 *
 * This is not the student's satellite ID.
 * It is only the local ESP configuration AP name.
 */
const char *WIFI_SETUP_NAME =
    "cansat_wifi ";

/*
 * Firmware version.
 */
const char *FIRMWARE_VERSION =
    "5.3.3";

// Local ESP hardware ID
String nodeId;
/*
 * ============================================================================
 * CENTRAL TELEMETRY API CONFIGURATION
 * ============================================================================
 *
 * ONLY THESE THREE VALUES ARE MANUALLY CONFIGURED FOR EACH SATELLITE.
 */

// 1. Unique satellite ID
const char *SATELLITE_ID =
    "SAT-TEST-001";


// 2. Central telemetry API
//
// LOCAL TEST EXAMPLE:
// http://10.212.254.44:5000/api/v1/telemetry
//
// PRODUCTION EXAMPLE:
// https://api.yourdomain.com/api/v1/telemetry
const char *MQTT_HOST =
    "192.168.137.1";

const int MQTT_PORT =
    1883;

const char *CENTRAL_API_URL =
    "http://192.168.137.1:5000/api/v1/telemetry";


// 3. Fleet API key
const char *FLEET_API_KEY =
    "q99/rO4GXt/tM+uj802E2jcvhIAs1itwlRMbNRIHG9s=";

WiFiClient mqttWifiClient;
PubSubClient mqttClient(mqttWifiClient);
unsigned long lastMqttReconnectAttempt = 0;


// ==============================================================================
// [TELEMETRY STATE]
// ==============================================================================

/*
 * This sequence is kept ONLY for the ESP's local LittleFS logs
 * and local dashboard.
 *
 * It is NOT sent to the Central Telemetry API.
 */
uint32_t telemetrySequence = 0;


// Metadata used by the local ESP dashboard.
// These are not required for the central telemetry API.
String studentName = "";
String schoolName = "";


// ==============================================================================
// [MDNS]
// ==============================================================================

String generateMDNSName(String ssid) {
  String host = ssid;

  host.toLowerCase();
  host.replace("_", "-");
  host.replace(" ", "-");

  return host;
}


// ==============================================================================
// [SENSORS]
// ==============================================================================

// DHT11 on D5 / GPIO14
#define DHTPIN 14
#define DHTTYPE DHT11

DHT dht(
    DHTPIN,
    DHTTYPE
);


// BMP280
Adafruit_BMP280 bmp;


// MPU6500
const uint8_t MPU_ADDR =
    0x68;


// Flash button
#define FLASH_BUTTON_PIN 0


// GPS on D6(GPIO12) and D7(GPIO13)
SoftwareSerial gpsSerial(
    12,
    13
);

TinyGPSPlus gps;


// ==============================================================================
// [CAMERA UDP DISCOVERY]
// ==============================================================================

WiFiUDP udpListener;

const int UDP_PORT =
    4210;

String discoveredCamIP =
    "";

const int MAX_CAMS =
    5;

String foundCamIPs[MAX_CAMS];

unsigned long foundCamTimes[MAX_CAMS];


// ==============================================================================
// [NETWORK / LOCATION]
// ==============================================================================

IPAddress customApIP(
    100,
    100,
    100,
    1
);

float currentLat =
    0.0;

float currentLng =
    0.0;

float currentHeading =
    0.0;

unsigned long lastHardwareGpsTime =
    0;

String currentLocSource =
    "Awaiting Fix 🟠";

float lastOffLat =
    0.0;

float lastOffLng =
    0.0;

float browserLat =
    0.0;

float browserLng =
    0.0;

bool hasBrowserData =
    false;


// ==============================================================================
// [SENSOR VALUES]
// ==============================================================================

float currentTemp =
    0.0;

float currentHum =
    0.0;

float currentPres =
    0.0;

float currentBmpAlt =
    0.0;

float groundAltBaseline =
    0.0;

float seaLevelPressure =
    1013.25;

float currentPitch =
    0.0;

float currentRoll =
    0.0;

float currentAccelZ =
    0.0;


// ==============================================================================
// [SENSOR STATUS]
// ==============================================================================

bool dhtOK =
    false;

bool bmpOK =
    false;

bool mpuOK =
    false;

bool camOK =
    false;

int dhtFailCount =
    0;


// ==============================================================================
// [ACCESS POINT / WIFI]
// ==============================================================================

bool apActive =
    true;

bool apAlwaysOn =
    true;

unsigned long apStartTime =
    0;


// ==============================================================================
// [ESP LOCAL SERVERS]
// ==============================================================================

ESP8266WebServer server(
    80
);

WebSocketsServer webSocket =
    WebSocketsServer(81);

WiFiManager wm;

bool launchPortal =
    false;


// ==============================================================================
// [LOCAL LOGGING / LEGACY UI SETTINGS]
// ==============================================================================
//
// enableCloudLogging is retained as the existing dashboard toggle variable.
// It now controls CENTRAL telemetry upload instead of Google Apps Script.
//
// currentScriptUrl is retained only for compatibility with the existing
// local dashboard UI. It is NOT used by the central telemetry upload.
// ==============================================================================

bool enableCloudLogging =
    true;

String defaultScriptUrl =
    "";

String currentScriptUrl =
    defaultScriptUrl;


// ==============================================================================
// [EEPROM CONFIGURATION]
// ==============================================================================

const int EEPROM_URL_START =
    0;

const int EEPROM_URL_BYTES =
    256;

const int EEPROM_LOCATION_MARKER =
    264;

const int EEPROM_LOG_INDEX_ADDR =
    268;

const int EEPROM_LOG_INDEX_MARKER =
    272;

const int EEPROM_STUDENT_START =
    280;

const int EEPROM_SCHOOL_START =
    344;


// ==============================================================================
// [LITTLEFS LOGGING]
// ==============================================================================

int currentLogIndex =
    0;

size_t currentLogSize =
    0;


// ==============================================================================
// [EEPROM HELPERS]
// ==============================================================================

void saveStringToEEPROM(
    int startAddr,
    String data,
    int maxLength
) {
  if (
      data.length() >=
      (size_t)maxLength
  ) {
    data =
        data.substring(
            0,
            maxLength - 1
        );
  }

  for (
      int i = 0;
      i < maxLength;
      i++
  ) {
    EEPROM.write(
        startAddr + i,
        0
    );
  }

  for (
      size_t i = 0;
      i < data.length();
      ++i
  ) {
    EEPROM.write(
        startAddr + i,
        data[i]
    );
  }

  EEPROM.write(
      startAddr + data.length(),
      '\0'
  );

  EEPROM.commit();
}


String readStringFromEEPROM(
    int startAddr,
    int maxLength
) {
  String res =
      "";

  for (
      int i = 0;
      i < maxLength;
      ++i
  ) {
    char c =
        EEPROM.read(
            startAddr + i
        );

    if (
        c == '\0' ||
        (uint8_t)c == 255
    ) {
      break;
    }

    res += c;
  }

  return res;
}


// ==============================================================================
// [LOG FILE SECURITY]
// ==============================================================================

bool isSafeLogFilename(
    const String &name
) {
  if (
      !name.startsWith("log_") ||
      !name.endsWith(".csv")
  ) {
    return false;
  }

  if (
      name.indexOf("..") >= 0 ||
      name.indexOf('/') >= 0 ||
      name.indexOf('\\') >= 0
  ) {
    return false;
  }

  if (
      name.length() < 9 ||
      name.length() > 20
  ) {
    return false;
  }

  for (
      unsigned int i = 4;
      i < name.length() - 4;
      i++
  ) {
    if (
        !isDigit(
            name[i]
        )
    ) {
      return false;
    }
  }

  return true;
}


// ==============================================================================
// [LOG INDEX]
// ==============================================================================

void saveLogIndex() {
  EEPROM.put(
      EEPROM_LOG_INDEX_ADDR,
      currentLogIndex
  );

  EEPROM.write(
      EEPROM_LOG_INDEX_MARKER,
      0xA6
  );

  EEPROM.commit();
}


// ==============================================================================
// [TIME]
// ==============================================================================

unsigned long bootEpochTime =
    0;

bool timeSynced =
    false;


// ==============================================================================
// [LOCAL TELEMETRY RECORD]
// ==============================================================================

struct TelemetryRecord {

  uint32_t sequence;

  unsigned long timestamp;

  float temp;

  float hum;

  float pres;

  float alt;

  float pitch;

  float roll;

  float lat;

  float lng;
};


// ==============================================================================
// [LOCAL RAM BUFFER]
// ==============================================================================

const int BUFFER_SIZE =
    20;

TelemetryRecord ramBuffer[
    BUFFER_SIZE
];

int bufferIndex =
    0;

const int MAX_LOG_SIZE =
    200000;


// ==============================================================================
// [FLUSH BUFFER TO LITTLEFS]
// ==============================================================================

void flushToLittleFS() {

  if (
      bufferIndex == 0
  ) {
    return;
  }


  String filename =
      "/log_" +
      String(
          currentLogIndex
      ) +
      ".csv";


  File f =
      LittleFS.open(
          filename,
          "a"
      );


  if (!f) {
    return;
  }


  if (
      f.size() == 0
  ) {

    int w =
        f.println(
            "Sequence,Timestamp,Temp_C,Hum_%,Pres_hPa,Alt_m,Pitch_deg,Roll_deg,Lat,Lng"
        );

    if (w > 0) {
      currentLogSize +=
          w;
    }
  }


  for (
      int i = 0;
      i < bufferIndex;
      i++
  ) {

    unsigned long recordTime =
        timeSynced
            ? (
                bootEpochTime +
                (
                    ramBuffer[i].timestamp /
                    1000
                )
              )
            : (
                ramBuffer[i].timestamp /
                1000
              );


    int w =
        f.printf(
            "%u,%lu,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%.6f,%.6f\n",
            ramBuffer[i].sequence,
            recordTime,
            ramBuffer[i].temp,
            ramBuffer[i].hum,
            ramBuffer[i].pres,
            ramBuffer[i].alt,
            ramBuffer[i].pitch,
            ramBuffer[i].roll,
            ramBuffer[i].lat,
            ramBuffer[i].lng
        );


    if (w > 0) {
      currentLogSize +=
          w;
    }
  }


  f.close();

  bufferIndex =
      0;


  if (
      currentLogSize >
      MAX_LOG_SIZE
  ) {

    currentLogIndex =
        (
            currentLogIndex + 1
        ) %
        5;


    LittleFS.remove(
        "/log_" +
        String(
            currentLogIndex
        ) +
        ".csv"
    );


    currentLogSize =
        0;


    saveLogIndex();
  }
}


// ==============================================================================
// [MPU6500]
// ==============================================================================

bool initMPU6500() {

  Wire.beginTransmission(
      MPU_ADDR
  );

  Wire.write(
      0x6B
  );

  Wire.write(
      0x00
  );

  if (
      Wire.endTransmission() != 0
  ) {
    return false;
  }


  Wire.beginTransmission(
      MPU_ADDR
  );

  Wire.write(
      0x1C
  );

  Wire.write(
      0x00
  );

  if (
      Wire.endTransmission() != 0
  ) {
    return false;
  }


  Wire.beginTransmission(
      MPU_ADDR
  );

  Wire.write(
      0x75
  );


  if (
      Wire.endTransmission(false) != 0 ||
      Wire.requestFrom(
          (uint8_t)MPU_ADDR,
          (uint8_t)1
      ) != 1
  ) {
    return false;
  }


  uint8_t identity =
      Wire.read();


  return (
      identity == 0x68 ||
      identity == 0x70 ||
      identity == 0x71 ||
      identity == 0x73
  );
}


// ==============================================================================
// [CAMERA DISCOVERY]
// ==============================================================================

void registerDiscoveredCamera(
    const String &candidate
) {

  IPAddress parsed;


  if (
      !parsed.fromString(
          candidate
      )
  ) {
    return;
  }


  String normalized =
      parsed.toString();


  for (
      int i = 0;
      i < MAX_CAMS;
      i++
  ) {

    if (
        foundCamIPs[i] ==
        normalized
    ) {

      foundCamTimes[i] =
          millis();

      return;
    }
  }


  int slot =
      0;


  for (
      int i = 1;
      i < MAX_CAMS;
      i++
  ) {

    if (
        foundCamIPs[i].length() == 0 ||
        foundCamTimes[i] <
            foundCamTimes[slot]
    ) {
      slot =
          i;
    }
  }


  foundCamIPs[slot] =
      normalized;

  foundCamTimes[slot] =
      millis();
}


// ==============================================================================
// [LOCAL TELEMETRY JSON]
// ==============================================================================

String buildTelemetryJSON() {

  String status =
      (
          dhtOK &&
          bmpOK &&
          mpuOK
      )
          ? "All Systems Nominal 🟢"
          : "Partial Sensor Warning 🟠";


  if (
      !dhtOK &&
      !bmpOK &&
      !mpuOK
  ) {
    status =
        "Critical Sensor Failure 🔴";
  }


  String dhtStatusStr =
      dhtOK
          ? "Nominal 🟢"
          : "Offline 🔴";


  String bmpStatusStr =
      bmpOK
          ? "Nominal 🟢"
          : "Offline 🔴";


  String mpuStatusStr =
      mpuOK
          ? "Nominal 🟢"
          : "Offline 🔴";


  String gpsHwStatusStr =
      (
          millis() -
              lastHardwareGpsTime <
          10000 &&
          lastHardwareGpsTime > 0
      )
          ? "Fix Locked 🟢"
          : "No Fix 🔴";


  String json =
      "{";


  json.reserve(
      800
  );


  json +=
      "\"nodeId\":\"" +
      String(
          WIFI_SETUP_NAME
      ) +
      "\",";


  json +=
      "\"satelliteId\":\"" +
      String(
          SATELLITE_ID
      ) +
      "\",";


  json +=
      "\"firmware\":\"" +
      String(
          FIRMWARE_VERSION
      ) +
      "\",";


  json +=
      "\"sequence\":" +
      String(
          telemetrySequence
      ) +
      ",";


  json +=
      "\"student\":\"" +
      studentName +
      "\",";


  json +=
      "\"school\":\"" +
      schoolName +
      "\",";


  json +=
      "\"temperature\":\"" +
      (
          dhtOK
              ? String(
                    currentTemp,
                    1
                )
              : "--"
      ) +
      "\",";


  json +=
      "\"humidity\":\"" +
      (
          dhtOK
              ? String(
                    currentHum,
                    1
                )
              : "--"
      ) +
      "\",";


  json +=
      "\"pressure\":\"" +
      (
          bmpOK
              ? String(
                    currentPres,
                    2
                )
              : "--"
      ) +
      "\",";


  json +=
      "\"bmpAltSea\":\"" +
      (
          bmpOK
              ? String(
                    currentBmpAlt,
                    2
                )
              : "--"
      ) +
      "\",";


  json +=
      "\"bmpAltGround\":\"" +
      (
          bmpOK
              ? String(
                    currentBmpAlt -
                        groundAltBaseline,
                    2
                )
              : "--"
      ) +
      "\",";


  json +=
      "\"pitch\":\"" +
      (
          mpuOK
              ? String(
                    currentPitch,
                    1
                )
              : "--"
      ) +
      "\",";


  json +=
      "\"roll\":\"" +
      (
          mpuOK
              ? String(
                    currentRoll,
                    1
                )
              : "--"
      ) +
      "\",";


  json +=
      "\"accel\":\"" +
      (
          mpuOK
              ? String(
                    currentAccelZ,
                    2
                )
              : "--"
      ) +
      "\",";


  json +=
      "\"apIp\":\"" +
      (
          apActive
              ? WiFi.softAPIP().toString()
              : "--"
      ) +
      "\",";


  json +=
      "\"staIp\":\"" +
      (
          WiFi.status() ==
                  WL_CONNECTED
              ? WiFi.localIP().toString()
              : "Offline"
      ) +
      "\",";


  json +=
      "\"apStatus\":\"" +
      String(
          apActive
              ? "ON 🟢"
              : "OFF 🔴"
      ) +
      "\",";


  json +=
      "\"ntpSynced\":" +
      String(
          timeSynced
              ? "true"
              : "false"
      ) +
      ",";


  json +=
      "\"camIP\":\"" +
      discoveredCamIP +
      "\",";


  json +=
      "\"cloudEnabled\":" +
      String(
          enableCloudLogging
              ? "true"
              : "false"
      ) +
      ",";


  json +=
      "\"sheetUrl\":\"" +
      currentScriptUrl +
      "\",";


  json +=
      "\"sensorStatus\":\"" +
      status +
      "\",";


  json +=
      "\"dhtStatus\":\"" +
      dhtStatusStr +
      "\",";


  json +=
      "\"bmpStatus\":\"" +
      bmpStatusStr +
      "\",";


  json +=
      "\"mpuStatus\":\"" +
      mpuStatusStr +
      "\",";


  json +=
      "\"gpsHwStatus\":\"" +
      gpsHwStatusStr +
      "\",";


  json +=
      "\"locSource\":\"" +
      currentLocSource +
      "\",";


  json +=
      "\"lat\":\"" +
      String(
          currentLat,
          6
      ) +
      "\",";


  json +=
      "\"lng\":\"" +
      String(
          currentLng,
          6
      ) +
      "\",";


  json +=
      "\"heading\":\"" +
      String(
          currentHeading,
          2
      ) +
      "\",";


  json +=
      "\"rssi\":\"" +
      String(
          WiFi.RSSI()
      ) +
      "\",";


  json +=
      "\"uptime\":\"" +
      String(
          millis() /
          60000
      ) +
      " mins\",";


  json +=
      "\"freeHeap\":\"" +
      String(
          ESP.getFreeHeap()
      ) +
      " bytes\",";


  json +=
      "\"sketchSize\":\"" +
      String(
          ESP.getSketchSize() /
          1024
      ) +
      " KB\",";


  json +=
      "\"cpuFreq\":\"" +
      String(
          ESP.getCpuFreqMHz()
      ) +
      " MHz\",";


  json +=
      "\"ssid\":\"" +
      String(
          WiFi.status() ==
                  WL_CONNECTED
              ? WiFi.SSID()
              : "AP Mode Only"
      ) +
      "\",";


  json +=
      "\"qnh\":\"" +
      String(
          seaLevelPressure,
          2
      ) +
      "\"";


  json +=
      "}";


  return json;
}


// ==============================================================================
// [WEBSOCKET]
// ==============================================================================

unsigned long webSocketInterval =
    2500;


void webSocketEvent(
    uint8_t num,
    WStype_t type,
    uint8_t *payload,
    size_t length
) {

  if (
      type ==
      WStype_TEXT
  ) {

    String msg =
        (char *)payload;


    if (
        msg.startsWith(
            "RATE:"
        )
    ) {

      unsigned long newRate =
          msg.substring(
              5
          ).toInt();


      if (
          newRate >= 100
      ) {
        webSocketInterval =
            newRate;
      }

    } else if (
        msg ==
        "FORCE_FETCH"
    ) {

      String jsonPayload =
          buildTelemetryJSON();


      webSocket.sendTXT(
          num,
          jsonPayload
      );
    }
  }
}


// ==============================================================================
// [TASK SCHEDULER]
// ==============================================================================

unsigned long hardwarePollInterval =
    2000;

unsigned long logPollInterval =
    1000;


/*
 * Central telemetry upload interval.
 *
 * 2000 ms = 1 packet every 2 seconds.
 */
unsigned long telemetryUploadInterval =
    2000;


struct Task {

  unsigned long *intervalPtr;

  unsigned long lastRunTime;

  void (*execute)();
};


// ==============================================================================
// [SENSOR TASK]
// ==============================================================================

void readSensorsTask() {

  static int hardwareReadState =
      0;

  static int bmpFailCount =
      0;

  static int mpuFailCount =
      0;

  const int I2C_RETRY_THRESHOLD =
      5;


  if (
      hardwareReadState ==
      0
  ) {

    float t =
        dht.readTemperature();

    float h =
        dht.readHumidity();


    if (
        !isnan(t) &&
        !isnan(h)
    ) {

      currentTemp =
          t;

      currentHum =
          h;

      dhtOK =
          true;

      dhtFailCount =
          0;

    } else {

      dhtFailCount++;


      if (
          dhtFailCount >
          5
      ) {
        dhtOK =
            false;
      }
    }


    hardwareReadState =
        1;


  } else if (
      hardwareReadState ==
      1
  ) {

    if (
        bmpOK
    ) {

      float p =
          bmp.readPressure();


      if (
          isnan(p) ||
          p == 0
      ) {

        bmpFailCount++;


        if (
            bmpFailCount >=
            I2C_RETRY_THRESHOLD
        ) {

          Wire.begin(
              4,
              5
          );


          bmpOK =
              bmp.begin(0x76) ||
              bmp.begin(0x77);


          bmpFailCount =
              0;
        }

      } else {

        currentPres =
            p / 100.0F;

        currentBmpAlt =
            bmp.readAltitude(
                seaLevelPressure
            );

        bmpFailCount =
            0;
      }

    } else {

      bmpFailCount++;


      if (
          bmpFailCount >=
          I2C_RETRY_THRESHOLD
      ) {

        Wire.begin(
            4,
            5
        );


        bmpOK =
            bmp.begin(0x76) ||
            bmp.begin(0x77);


        bmpFailCount =
            0;
      }
    }


    hardwareReadState =
        2;


  } else {

    if (
        mpuOK
    ) {

      Wire.beginTransmission(
          MPU_ADDR
      );

      Wire.write(
          0x3B
      );


      if (
          Wire.endTransmission(false) ==
              0 &&
          Wire.requestFrom(
              (uint8_t)MPU_ADDR,
              (uint8_t)6
          ) ==
              6
      ) {

        float accelX =
            (
                (
                    Wire.read() <<
                    8
                ) |
                Wire.read()
            ) /
            16384.0;


        float accelY =
            (
                (
                    Wire.read() <<
                    8
                ) |
                Wire.read()
            ) /
            16384.0;


        float accelZ =
            (
                (
                    Wire.read() <<
                    8
                ) |
                Wire.read()
            ) /
            16384.0;


        currentAccelZ =
            accelZ;


        currentPitch =
            atan2(
                -accelX,
                sqrt(
                    accelY *
                    accelY +
                    accelZ *
                    accelZ
                )
            ) *
            180.0 /
            PI;


        currentRoll =
            atan2(
                accelY,
                accelZ
            ) *
            180.0 /
            PI;


        mpuFailCount =
            0;

      } else {

        mpuFailCount++;


        if (
            mpuFailCount >=
            I2C_RETRY_THRESHOLD
        ) {

          Wire.begin(
              4,
              5
          );


          mpuOK =
              initMPU6500();


          mpuFailCount =
              0;
        }
      }

    } else {

      mpuFailCount++;


      if (
          mpuFailCount >=
          I2C_RETRY_THRESHOLD
      ) {

        Wire.begin(
            4,
            5
        );


        mpuOK =
            initMPU6500();


        mpuFailCount =
            0;
      }
    }


    hardwareReadState =
        0;
  }
}


// ==============================================================================
// [LOCAL LOGGING TASK]
// ==============================================================================

void logToBufferTask() {

  if (
      bufferIndex <
      BUFFER_SIZE
  ) {

    ramBuffer[
        bufferIndex
    ].sequence =
        ++telemetrySequence;


    ramBuffer[
        bufferIndex
    ].timestamp =
        millis();


    ramBuffer[
        bufferIndex
    ].temp =
        currentTemp;


    ramBuffer[
        bufferIndex
    ].hum =
        currentHum;


    ramBuffer[
        bufferIndex
    ].pres =
        currentPres;


    ramBuffer[
        bufferIndex
    ].alt =
        currentBmpAlt -
        groundAltBaseline;


    ramBuffer[
        bufferIndex
    ].pitch =
        currentPitch;


    ramBuffer[
        bufferIndex
    ].roll =
        currentRoll;


    ramBuffer[
        bufferIndex
    ].lat =
        currentLat;


    ramBuffer[
        bufferIndex
    ].lng =
        currentLng;


    bufferIndex++;
  }


  if (
      bufferIndex >=
      BUFFER_SIZE
  ) {
    flushToLittleFS();
  }
}


// ==============================================================================
// [UTC TIMESTAMP]
// ==============================================================================

String getUtcIsoTimestamp() {

  if (!timeSynced) {
    return "";
  }

  time_t now =
      bootEpochTime +
      (millis() / 1000);

  if (now < 100000) {
    return "";
  }

  struct tm *utcTime =
      gmtime(
          &now
      );

  if (!utcTime) {
    return "";
  }

  char buffer[
      25
  ];

  strftime(
      buffer,
      sizeof(buffer),
      "%Y-%m-%dT%H:%M:%SZ",
      utcTime
  );

  return String(
      buffer
  );
}
// ==============================================================================
// [CENTRAL TELEMETRY API]
// ==============================================================================

void sendToCentralTelemetryTask() {

  /*
   * Existing local dashboard toggle is retained.
   *
   * If disabled from the local UI,
   * central telemetry upload is disabled.
   */
  if (
      !enableCloudLogging
  ) {
    return;
  }


  /*
   * Wi-Fi must be connected.
   */
  if (
      WiFi.status() !=
      WL_CONNECTED
  ) {

    return;
  }


  /*
   * We need accurate UTC time.
   */
  String timestamp =
      getUtcIsoTimestamp();


  if (
      timestamp.length() == 0
  ) {

    Serial.println(
        "Telemetry waiting for UTC time sync..."
    );

    return;
  }


  /*
   * Avoid network work when memory is low.
   */
  if (
      ESP.getFreeHeap() <
      16000
  ) {

    Serial.println(
        "Telemetry skipped: low heap."
    );

    return;
  }


  /*
   * Build the packet required by the backend.
   *
   * No boot_id.
   * No sequence_no.
   */
  String payload;

  payload.reserve(
      700
  );


  payload +=
      "{";


  payload +=
      "\"satellite_id\":\"" +
      String(
          SATELLITE_ID
      ) +
      "\",";


  payload +=
      "\"schema_version\":1,";


  payload +=
      "\"timestamp\":\"" +
      timestamp +
      "\",";


  payload +=
      "\"telemetry\":{";


  /*
   * Altitude MSL
   */
  if (
      bmpOK
  ) {

    payload +=
        "\"altitude_msl\":" +
        String(
            currentBmpAlt,
            2
        );

  } else {

    payload +=
        "\"altitude_msl\":null";
  }


  payload +=
      ",";


  /*
   * Altitude AGL
   */
  if (
      bmpOK
  ) {

    payload +=
        "\"altitude_agl\":" +
        String(
            currentBmpAlt -
            groundAltBaseline,
            2
        );

  } else {

    payload +=
        "\"altitude_agl\":null";
  }


  payload +=
      ",";


  /*
   * Temperature
   */
  if (
      dhtOK
  ) {

    payload +=
        "\"temperature\":" +
        String(
            currentTemp,
            2
        );

  } else {

    payload +=
        "\"temperature\":null";
  }


  payload +=
      ",";


  /*
   * Humidity
   */
  if (
      dhtOK
  ) {

    payload +=
        "\"humidity\":" +
        String(
            currentHum,
            2
        );

  } else {

    payload +=
        "\"humidity\":null";
  }


  payload +=
      ",";


  /*
   * Pitch
   */
  if (
      mpuOK
  ) {

    payload +=
        "\"pitch\":" +
        String(
            currentPitch,
            2
        );

  } else {

    payload +=
        "\"pitch\":null";
  }


  payload +=
      ",";


  /*
   * Roll
   */
  if (
      mpuOK
  ) {

    payload +=
        "\"roll\":" +
        String(
            currentRoll,
            2
        );

  } else {

    payload +=
        "\"roll\":null";
  }


  payload +=
      ",";


  /*
   * Acceleration
   */
  if (
      mpuOK
  ) {

    payload +=
        "\"acceleration\":" +
        String(
            currentAccelZ,
            2
        );

  } else {

    payload +=
        "\"acceleration\":null";
  }


  payload +=
      ",";


  /*
   * Wi-Fi RSSI
   */
  payload +=
      "\"wifi_rssi\":" +
      String(
          WiFi.RSSI()
      );


  payload +=
      "}";


  payload +=
      "}";


  /*
   * ============================================================================
   * MQTT PUBLISH
   * ============================================================================
   */
  if (mqttClient.connected()) {
    String topic = String("telemetry/") + String(SATELLITE_ID);
    if (mqttClient.publish(topic.c_str(), payload.c_str())) {
      Serial.println("Telemetry published via MQTT successfully.");
    } else {
      Serial.println("Telemetry MQTT publish failed.");
    }
  } else {
    Serial.println("Telemetry MQTT publish skipped: not connected to broker.");
  }
}


// ==============================================================================
// [NETWORK TIME SYNC]
// ==============================================================================

// ==============================================================================
// [NETWORK TIME SYNC]
// ==============================================================================

unsigned long networkPollInterval =
    30000;


// ==============================================================================
// [CENTRAL API TIME FALLBACK]
// ==============================================================================

bool syncTimeFromCentralAPI() {

  if (
      WiFi.status() !=
      WL_CONNECTED
  ) {
    return false;
  }


  WiFiClient client;

  HTTPClient http;


  http.setTimeout(
      3000
  );


  const char *headerKeys[] = {
      "Date"
  };


  http.collectHeaders(
      headerKeys,
      1
  );


  if (
      !http.begin(
          client,
          CENTRAL_API_URL
      )
  ) {

    Serial.println(
        "Central API time fallback: connection failed."
    );

    return false;
  }


  Serial.print(
      "Time fallback URL: "
  );

  Serial.println(
      CENTRAL_API_URL
  );


  int httpCode =
      http.GET();


  Serial.print(
      "Time fallback HTTP status: "
  );

  Serial.println(
      httpCode
  );


  String dateHeader =
      http.header(
          "Date"
      );


  Serial.print(
      "Time fallback Date header: ["
  );

  Serial.print(
      dateHeader
  );

  Serial.println(
      "]"
  );


  http.end();


  if (
      dateHeader.length() == 0
  ) {

    Serial.println(
        "Time fallback failed: Date header missing."
    );

    return false;
  }


  /*
   * Expected HTTP Date format:
   *
   * Sat, 26 Sep 2026 18:11:10 GMT
   */


  int comma =
      dateHeader.indexOf(
          ','
      );


  int firstSpace =
      dateHeader.indexOf(
          ' ',
          comma + 1
      );


  int secondSpace =
      dateHeader.indexOf(
          ' ',
          firstSpace + 1
      );


  int thirdSpace =
      dateHeader.indexOf(
          ' ',
          secondSpace + 1
      );


  int fourthSpace =
      dateHeader.indexOf(
          ' ',
          thirdSpace + 1
      );


  if (
      comma < 0 ||
      firstSpace < 0 ||
      secondSpace < 0 ||
      thirdSpace < 0 ||
      fourthSpace < 0
  ) {

    Serial.println(
        "Time fallback failed: invalid Date header format."
    );

    return false;
  }


  int day =
      dateHeader.substring(
          firstSpace + 1,
          secondSpace
      ).toInt();


  String month =
      dateHeader.substring(
          secondSpace + 1,
          thirdSpace
      );


  int year =
      dateHeader.substring(
          thirdSpace + 1,
          fourthSpace
      ).toInt();


  int colon1 =
      dateHeader.indexOf(
          ':',
          fourthSpace + 1
      );


  int colon2 =
      dateHeader.indexOf(
          ':',
          colon1 + 1
      );


  if (
      colon1 < 0 ||
      colon2 < 0
  ) {

    Serial.println(
        "Time fallback failed: invalid time format."
    );

    return false;
  }


  int hour =
      dateHeader.substring(
          fourthSpace + 1,
          colon1
      ).toInt();


  int minute =
      dateHeader.substring(
          colon1 + 1,
          colon2
      ).toInt();


  int second =
      dateHeader.substring(
          colon2 + 1
      ).toInt();


  int monthNumber =
      0;


  if (
      month == "Jan"
  ) {

    monthNumber =
        1;

  } else if (
      month == "Feb"
  ) {

    monthNumber =
        2;

  } else if (
      month == "Mar"
  ) {

    monthNumber =
        3;

  } else if (
      month == "Apr"
  ) {

    monthNumber =
        4;

  } else if (
      month == "May"
  ) {

    monthNumber =
        5;

  } else if (
      month == "Jun"
  ) {

    monthNumber =
        6;

  } else if (
      month == "Jul"
  ) {

    monthNumber =
        7;

  } else if (
      month == "Aug"
  ) {

    monthNumber =
        8;

  } else if (
      month == "Sep"
  ) {

    monthNumber =
        9;

  } else if (
      month == "Oct"
  ) {

    monthNumber =
        10;

  } else if (
      month == "Nov"
  ) {

    monthNumber =
        11;

  } else if (
      month == "Dec"
  ) {

    monthNumber =
        12;
  }


  if (
      monthNumber == 0 ||
      day < 1 ||
      day > 31 ||
      year < 2020 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
  ) {

    Serial.println(
        "Time fallback failed: invalid date values."
    );

    return false;
  }


  /*
   * Convert UTC calendar date to Unix epoch.
   *
   * This avoids depending on timegm()
   * availability in the ESP8266 environment.
   */

  auto daysFromCivil =
      [](int y, unsigned m, unsigned d) -> long long {

        y -=
            m <= 2;


        const long long era =
            (
                y >= 0
                    ? y
                    : y - 399
            ) /
            400;


        const unsigned yoe =
            (unsigned)(
                y -
                era * 400
            );


        const unsigned doy =
            (
                153 *
                    (
                        m +
                        (
                            m > 2
                                ? -3
                                : 9
                        )
                    ) +
                2
            ) /
                5 +
            d -
            1;


        const unsigned doe =
            yoe * 365 +
            yoe / 4 -
            yoe / 100 +
            doy;


        return
            era * 146097 +
            (long long)doe -
            719468;
      };


  long long days =
      daysFromCivil(
          year,
          monthNumber,
          day
      );


  long long epoch =
      days * 86400LL +
      hour * 3600LL +
      minute * 60LL +
      second;


  if (
      epoch < 100000
  ) {

    Serial.println(
        "Time fallback failed: invalid epoch."
    );

    return false;
  }


  Serial.print(
      "Time fallback parsed epoch: "
  );


  Serial.println(
      (unsigned long)epoch
  );


  /*
   * Store the server UTC time as the
   * reference point for millis().
   *
   * getUtcIsoTimestamp() uses this value
   * to generate the telemetry timestamp.
   */

  bootEpochTime =
      (unsigned long)epoch -
      (
          millis() /
          1000
      );


  timeSynced =
      true;


  Serial.println(
      "UTC time synchronized from Central API server"
  );


  return true;
}


// ==============================================================================
// [NETWORK MAINTENANCE]
// ==============================================================================

void networkMaintenanceTask() {

  if (
      timeSynced ||
      WiFi.status() !=
          WL_CONNECTED
  ) {

    return;
  }


  /*
   * First attempt normal NTP synchronization.
   */

  configTime(
      0,
      0,
      "pool.ntp.org"
  );


  Serial.println(
      "Trying NTP time synchronization..."
  );


  time_t now =
      time(
          nullptr
      );


  if (
      now >
      100000
  ) {

    bootEpochTime =
        (unsigned long)now -
        (
            millis() /
            1000
        );


    timeSynced =
        true;


    Serial.println(
        "UTC time synchronized."
    );


    return;
  }


  /*
   * NTP did not provide valid time.
   *
   * Use the Central API server's HTTP Date
   * header as the fallback UTC source.
   */

  if (
      syncTimeFromCentralAPI()
  ) {

    return;
  }
}

// ==============================================================================
// [WEBSOCKET PUSH]
// ==============================================================================

void wsPushTask() {

  if (
      webSocket.connectedClients(
          true
      ) >
      0
  ) {

    String jsonPayload =
        buildTelemetryJSON();


    webSocket.broadcastTXT(
        jsonPayload
    );
  }
}


// ==============================================================================
// [TASK QUEUE]
// ==============================================================================

Task taskQueue[] = {

  {
      &hardwarePollInterval,
      0,
      readSensorsTask
  },

  {
      &logPollInterval,
      0,
      logToBufferTask
  },

  {
      &networkPollInterval,
      0,
      networkMaintenanceTask
  },

  {
      &telemetryUploadInterval,
      10000,
      sendToCentralTelemetryTask
  },

  {
      &webSocketInterval,
      0,
      wsPushTask
  }
};


const int NUM_TASKS =
    sizeof(taskQueue) /
    sizeof(taskQueue[0]);


// ==============================================================================
// [SETUP]
// ==============================================================================

void setup() {

  Serial.begin(
      115200
  );


  gpsSerial.begin(
      9600
  );


  pinMode(
      FLASH_BUTTON_PIN,
      INPUT_PULLUP
  );


  /*
   * Unique local ESP hardware ID.
   *
   * This is separate from SATELLITE_ID.
   */
  nodeId =
      "NODE-" +
      String(
          ESP.getChipId(),
          HEX
      );


  // LittleFS
  if (
      !LittleFS.begin()
  ) {

    Serial.println(
        "LittleFS Init Failed"
    );
  }


  // EEPROM
  EEPROM.begin(
      512
  );


  /*
   * Restore last known GPS location.
   */
  if (
      EEPROM.read(
          EEPROM_LOCATION_MARKER
      ) ==
      0xA5
  ) {

    EEPROM.get(
        256,
        lastOffLat
    );

    EEPROM.get(
        260,
        lastOffLng
    );
  }


  /*
   * Restore log chunk index.
   */
  if (
      EEPROM.read(
          EEPROM_LOG_INDEX_MARKER
      ) ==
      0xA6
  ) {

    EEPROM.get(
        EEPROM_LOG_INDEX_ADDR,
        currentLogIndex
    );


    if (
        currentLogIndex < 0 ||
        currentLogIndex >= 5
    ) {

      currentLogIndex =
          0;
    }
  }


  /*
   * Restore old local dashboard metadata.
   *
   * These values are NOT sent to the central telemetry API.
   */
  String savedURL =
      readStringFromEEPROM(
          EEPROM_URL_START,
          EEPROM_URL_BYTES
      );


  if (
      savedURL.startsWith(
          "http"
      )
  ) {

    currentScriptUrl =
        savedURL;
  }


  studentName =
      readStringFromEEPROM(
          EEPROM_STUDENT_START,
          64
      );


  schoolName =
      readStringFromEEPROM(
          EEPROM_SCHOOL_START,
          64
      );


  /*
   * Restore current log file size.
   */
  File fCheck =
      LittleFS.open(
          "/log_" +
              String(
                  currentLogIndex
              ) +
              ".csv",
          "r"
      );


  if (fCheck) {

    currentLogSize =
        fCheck.size();

    fCheck.close();
  }


  // ============================================================================
  // [DYNAMIC AP IP]
  // ============================================================================

  int nodeNum =
      1;


  String ssidStr =
      String(
          WIFI_SETUP_NAME
      );


  String numStr =
      "";


  for (
      size_t i = 0;
      i < ssidStr.length();
      i++
  ) {

    if (
        isDigit(
            ssidStr[i]
        )
    ) {

      numStr +=
          ssidStr[i];
    }
  }


  if (
      numStr.length() >
      0
  ) {

    nodeNum =
        numStr.toInt();
  }


  int subnetOffset =
      nodeNum /
      254;


  int ipEnd =
      nodeNum %
      254;


  if (
      ipEnd == 0
  ) {

    ipEnd =
        254;

    subnetOffset -=
        1;
  }


  customApIP =
      IPAddress(
          100,
          100,
          100 +
              subnetOffset,
          ipEnd
      );


  // ============================================================================
  // [WIFI MANAGER]
  // ============================================================================

  wm.setHttpPort(
      8080
  );


  wm.setConfigPortalBlocking(
      false
  );


  wm.setAPStaticIPConfig(
      customApIP,
      customApIP,
      IPAddress(
          255,
          255,
          255,
          0
      )
  );


  wm.autoConnect(
      WIFI_SETUP_NAME
  );


  /*
   * Disable Wi-Fi sleep to avoid long delays.
   */
  WiFi.setSleepMode(
      WIFI_NONE_SLEEP
  );


  /*
   * Dual AP + STA mode.
   */
  WiFi.mode(
      WIFI_AP_STA
  );


  WiFi.softAPConfig(
      customApIP,
      customApIP,
      IPAddress(
          255,
          255,
          255,
          0
      )
  );


  WiFi.softAP(
      WIFI_SETUP_NAME
  );


  apStartTime =
      millis();


  apActive =
      true;


  // ============================================================================
  // [MDNS]
  // ============================================================================

  String mdnsHost =
      generateMDNSName(
          WIFI_SETUP_NAME
      );


  if (
      MDNS.begin(
          mdnsHost.c_str()
      )
  ) {

    MDNS.addService(
        "http",
        "tcp",
        80
    );
  }


  // ============================================================================
  // [NETWORK / HARDWARE]
  // ============================================================================

  udpListener.begin(
      UDP_PORT
  );


  dht.begin();


  Wire.begin(
      4,
      5
  );


  bmpOK =
      bmp.begin(
          0x76
      ) ||
      bmp.begin(
          0x77
      );


  mpuOK =
      initMPU6500();


  // ============================================================================
  // [WEBSOCKET]
  // ============================================================================

  webSocket.begin();

  webSocket.onEvent(
      webSocketEvent
  );


  // ============================================================================
  // [LOCAL WEB SERVER]
  // ============================================================================

  server.on(
      "/",
      []() {

        server.sendHeader(
            "Connection",
            "close"
        );


        server.send_P(
            200,
            "text/html",
            index_html
        );
      }
  );


  /*
   * Local ESP telemetry endpoint.
   */
  server.on(
      "/api/telemetry",
      []() {

        server.sendHeader(
            "Connection",
            "close"
        );


        server.send(
            200,
            "application/json",
            buildTelemetryJSON()
        );
      }
  );


  // ============================================================================
  // [LOCAL METADATA]
  // ============================================================================

  server.on(
      "/update-meta",
      []() {

        if (
            server.hasArg(
                "student"
            )
        ) {

          studentName =
              server.arg(
                  "student"
              );


          saveStringToEEPROM(
              EEPROM_STUDENT_START,
              studentName,
              64
          );
        }


        if (
            server.hasArg(
                "school"
            )
        ) {

          schoolName =
              server.arg(
                  "school"
              );


          saveStringToEEPROM(
              EEPROM_SCHOOL_START,
              schoolName,
              64
          );
        }


        server.send(
            200,
            "text/plain",
            "OK"
        );
      }
  );


  // ============================================================================
  // [CENTRAL TELEMETRY TOGGLE]
  // ============================================================================
  //
  // Existing local UI names retained for compatibility.
  //

  server.on(
      "/toggle-cloud",
      []() {

        enableCloudLogging =
            !enableCloudLogging;


        server.send(
            200,
            "text/plain",
            "OK"
        );
      }
  );


  /*
   * Kept for compatibility with the existing local UI.
   *
   * It does not change the Central API URL.
   */
  server.on(
      "/update-url",
      []() {

        if (
            server.hasArg(
                "url"
            )
        ) {

          currentScriptUrl =
              server.arg(
                  "url"
              );


          saveStringToEEPROM(
              EEPROM_URL_START,
              currentScriptUrl,
              EEPROM_URL_BYTES
          );


          server.send(
              200,
              "text/plain",
              "OK"
          );
        }
      }
  );


  server.on(
      "/reset-url",
      []() {

        currentScriptUrl =
            defaultScriptUrl;


        saveStringToEEPROM(
            EEPROM_URL_START,
            currentScriptUrl,
            EEPROM_URL_BYTES
        );


        server.send(
            200,
            "text/plain",
            "OK"
        );
      }
  );


  // ============================================================================
  // [LOG FILE MANAGEMENT]
  // ============================================================================

  server.on(
      "/api/logs",
      []() {

        server.sendHeader(
            "Connection",
            "close"
        );


        String json =
            "[";


        bool first =
            true;


        Dir dir =
            LittleFS.openDir(
                "/"
            );


        while (
            dir.next()
        ) {

          if (
              dir.fileName()
                  .startsWith(
                      "log_"
                  )
          ) {

            if (
                !first
            ) {
              json +=
                  ",";
            }


            json +=
                "{\"name\":\"" +
                dir.fileName() +
                "\", \"size\":" +
                String(
                    dir.fileSize()
                ) +
                "}";


            first =
                false;
          }
        }


        json +=
            "]";


        server.send(
            200,
            "application/json",
            json
        );
      }
  );


  // ============================================================================
  // [CAMERA SCAN]
  // ============================================================================

  server.on(
      "/api/scan",
      []() {

        String json =
            "[";


        bool first =
            true;


        unsigned long now =
            millis();


        for (
            int i = 0;
            i < MAX_CAMS;
            i++
        ) {

          if (
              foundCamIPs[i].length() &&
              now -
                  foundCamTimes[i] <
                  30000
          ) {

            if (
                !first
            ) {
              json +=
                  ",";
            }


            json +=
                "\"" +
                foundCamIPs[i] +
                "\"";


            first =
                false;
          }
        }


        json +=
            "]";


        server.send(
            200,
            "application/json",
            json
        );
      }
  );


  // ============================================================================
  // [DOWNLOAD LOG]
  // ============================================================================

  server.on(
      "/download-log",
      []() {

        if (
            server.hasArg(
                "file"
            )
        ) {

          String filename =
              server.arg(
                  "file"
              );


          if (
              !isSafeLogFilename(
                  filename
              )
          ) {

            server.send(
                400,
                "text/plain",
                "Invalid filename"
            );

            return;
          }


          File file =
              LittleFS.open(
                  "/" +
                      filename,
                  "r"
              );


          if (
              !file
          ) {

            server.send(
                404,
                "text/plain",
                "File not found"
            );

            return;
          }


          server.sendHeader(
              "Content-Disposition",
              "attachment; filename=" +
                  filename
          );


          server.streamFile(
              file,
              "text/csv"
          );


          file.close();

        } else {

          server.send(
              400,
              "text/plain",
              "Bad Request"
          );
        }
      }
  );


  // ============================================================================
  // [FORMAT LOGS]
  // ============================================================================

  server.on(
      "/format-logs",
      []() {

        LittleFS.format();


        currentLogIndex =
            0;


        currentLogSize =
            0;


        saveLogIndex();


        server.send(
            200,
            "text/plain",
            "LittleFS Formatted."
        );
      }
  );


  // ============================================================================
  // [TOGGLE AP]
  // ============================================================================

  server.on(
      "/toggle-ap",
      []() {

        if (
            apActive
        ) {

          WiFi.mode(
              WIFI_STA
          );


          apActive =
              false;


          apAlwaysOn =
              false;


          server.send(
              200,
              "text/plain",
              "Hotspot Disabled"
          );

        } else {

          WiFi.mode(
              WIFI_AP_STA
          );


          WiFi.softAPConfig(
              customApIP,
              customApIP,
              IPAddress(
                  255,
                  255,
                  255,
                  0
              )
          );


          WiFi.softAP(
              WIFI_SETUP_NAME
          );


          apActive =
              true;


          apAlwaysOn =
              true;


          server.send(
              200,
              "text/plain",
              "Hotspot Enabled"
          );
        }
      }
  );


  // ============================================================================
  // [TIMING]
  // ============================================================================

  server.on(
      "/set-timing",
      []() {

        const unsigned long MIN_INTERVAL =
            100;


        if (
            server.hasArg(
                "hw"
            )
        ) {

          unsigned long v =
              server.arg(
                  "hw"
              ).toInt();


          if (
              v >=
              MIN_INTERVAL
          ) {

            hardwarePollInterval =
                v;
          }
        }


        if (
            server.hasArg(
                "log"
            )
        ) {

          unsigned long v =
              server.arg(
                  "log"
              ).toInt();


          if (
              v >=
              MIN_INTERVAL
          ) {

            logPollInterval =
                v;
          }
        }


        /*
         * Existing UI uses "cloud".
         * It now controls Central API upload interval.
         */
        if (
            server.hasArg(
                "cloud"
            )
        ) {

          unsigned long v =
              server.arg(
                  "cloud"
              ).toInt();


          if (
              v >=
              MIN_INTERVAL
          ) {

            telemetryUploadInterval =
                v;
          }
        }


        server.send(
            200,
            "text/plain",
            "Timing Updated"
        );
      }
  );


  // ============================================================================
  // [ALTITUDE RESET]
  // ============================================================================

  server.on(
      "/reset-alt",
      []() {

        groundAltBaseline =
            currentBmpAlt;


        server.send(
            200,
            "text/plain",
            "OK"
        );
      }
  );


  // ============================================================================
  // [QNH]
  // ============================================================================

  server.on(
      "/set-qnh",
      []() {

        if (
            !server.hasArg(
                "val"
            )
        ) {

          return server.send(
              400,
              "text/plain",
              "Missing val"
          );
        }


        float value =
            server.arg(
                "val"
            ).toFloat();


        if (
            !isfinite(
                value
            ) ||
            value < 800.0 ||
            value > 1200.0
        ) {

          return server.send(
              400,
              "text/plain",
              "Invalid QNH"
          );
        }


        seaLevelPressure =
            value;


        server.send(
            200,
            "text/plain",
            String(
                seaLevelPressure,
                2
            )
        );
      }
  );


  server.on(
      "/sync-qnh",
      []() {

        if (
            !bmpOK ||
            !isfinite(
                currentPres
            ) ||
            currentPres <
                300.0
        ) {

          return server.send(
              503,
              "text/plain",
              "Pressure unavailable"
          );
        }


        seaLevelPressure =
            currentPres;


        server.send(
            200,
            "text/plain",
            String(
                seaLevelPressure,
                2
            )
        );
      }
  );


  // ============================================================================
  // [WIFI CONFIG PORTAL]
  // ============================================================================

  server.on(
      "/open-portal",
      []() {

        server.send(
            200,
            "text/plain",
            "OK"
        );


        launchPortal =
            true;
      }
  );


  // ============================================================================
  // [FACTORY RESET]
  // ============================================================================

  server.on(
      "/factory-reset",
      []() {

        server.send(
            200,
            "text/plain",
            "Resetting Wi-Fi..."
        );


        wm.resetSettings();


        delay(
            500
        );


        ESP.restart();
      }
  );


  // ============================================================================
  // [BROWSER LOCATION]
  // ============================================================================

  server.on(
      "/set-location",
      []() {

        if (
            server.hasArg(
                "lat"
            ) &&
            server.hasArg(
                "lng"
            )
        ) {

          browserLat =
              server.arg(
                  "lat"
              ).toFloat();


          browserLng =
              server.arg(
                  "lng"
              ).toFloat();


          hasBrowserData =
              true;


          server.send(
              200,
              "text/plain",
              "OK"
          );

        } else {

          server.send(
              400,
              "text/plain",
              "Error"
          );
        }
      }
  );


  // ============================================================================
  // [START WEB SERVER]
  // ============================================================================

  server.begin();


  Serial.println();
  Serial.println(
      "===================================="
  );
  Serial.println(
      "CANSAT CENTRAL TELEMETRY READY"
  );
  Serial.println(
      "===================================="
  );


  Serial.print(
      "Satellite ID: "
  );


  Serial.println(
      SATELLITE_ID
  );


  Serial.print(
      "Central API: "
  );


  Serial.println(
      CENTRAL_API_URL
  );

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(1024);
}


// ==============================================================================
// [MQTT RECONNECT]
// ==============================================================================

void handleMqttConnection() {
  if (!mqttClient.connected()) {
    if (millis() - lastMqttReconnectAttempt > 5000) {
      lastMqttReconnectAttempt = millis();
      Serial.println("Attempting MQTT connection...");
      
      String clientId = "ESP8266Client-" + String(ESP.getChipId(), HEX);
      String topic = String("telemetry/") + SATELLITE_ID;
      
      if (mqttClient.connect(clientId.c_str(), SATELLITE_ID, FLEET_API_KEY)) {
        Serial.println("MQTT connected successfully.");
      } else {
        Serial.print("MQTT connect failed, rc=");
        Serial.print(mqttClient.state());
        Serial.println(" try again in 5 seconds");
      }
    }
  }
}

// ==============================================================================
// [LOOP]
// ==============================================================================

void loop() {
  handleMqttConnection();
  mqttClient.loop();


  // MDNS
  MDNS.update();


  // Local web server
  server.handleClient();


  // WebSocket
  webSocket.loop();


  // WiFiManager
  wm.process();


  // ============================================================================
  // TASK SCHEDULER
  // ============================================================================

  unsigned long currentMillis =
      millis();


  for (
      int i = 0;
      i < NUM_TASKS;
      i++
  ) {

    if (
        currentMillis -
            taskQueue[i].lastRunTime >=
        *taskQueue[i].intervalPtr
    ) {

      taskQueue[i].lastRunTime =
          currentMillis;


      taskQueue[i].execute();
    }
  }


  // ============================================================================
  // CAMERA UDP
  // ============================================================================

  int packetSize =
      udpListener.parsePacket();


  if (
      packetSize
  ) {

    char packetBuffer[
        255
    ];


    int len =
        udpListener.read(
            packetBuffer,
            254
        );


    if (
        len > 0
    ) {

      packetBuffer[len] =
          0;
    }


    String msg =
        String(
            packetBuffer
        );


    if (
        msg.startsWith(
            "CANSAT_CAM_IP:"
        )
    ) {

      String ip =
          msg.substring(
              14
          );


      registerDiscoveredCamera(
          ip
      );


      discoveredCamIP =
          ip;


      camOK =
          true;
    }
  }


  // ============================================================================
  // GPS
  // ============================================================================

  while (
      gpsSerial.available() >
      0
  ) {

    if (
        gps.encode(
            gpsSerial.read()
        )
    ) {

      if (
          gps.location.isValid()
      ) {

        currentLat =
            gps.location.lat();


        currentLng =
            gps.location.lng();


        currentHeading =
            gps.course.deg();


        currentLocSource =
            "Hardware GPS 🟢";


        lastHardwareGpsTime =
            millis();
      }
    }
  }


  // ============================================================================
  // GPS FALLBACK
  // ============================================================================

  if (
      millis() -
          lastHardwareGpsTime >
      10000
  ) {

    if (
        hasBrowserData
    ) {

      currentLat =
          browserLat;


      currentLng =
          browserLng;


      currentLocSource =
          "Ground Station (Browser) 💻";

    } else if (
        lastOffLat != 0.0 &&
        lastOffLng != 0.0
    ) {

      currentLat =
          lastOffLat;


      currentLng =
          lastOffLng;


      currentLocSource =
          "Last Known Position (EEPROM) 🟠";

    } else {

      currentLocSource =
          "Awaiting Valid Fix 🔴";
    }
  }


  // ============================================================================
  // WIFI CONFIG PORTAL
  // ============================================================================

  if (
      launchPortal
  ) {

    wm.startConfigPortal(
        (
            String(
                WIFI_SETUP_NAME
            ) +
            "_Config"
        ).c_str()
    );


    launchPortal =
        false;
  }
}