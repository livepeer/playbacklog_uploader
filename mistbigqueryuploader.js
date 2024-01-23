#!/bin/node

const crypto = require("crypto");

// Reference to the useragent parser
const uap = require("ua-parser-js");

// BigQuery library
const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery();

// UDP socket lib
const udp = require("dgram");

// Parse commandline arguments
var argv = require("yargs/yargs")(process.argv.slice(2)).argv;

if (argv.j) {
  let capa = {
    desc: "Handles uploading playback logs to BigQuery",
    friendly: "BigQuery playback log uploader",
    name: "livepeer-mist-bigquery-uploader",
    required: {
      port: {
        help: "Port to listen on with UDP socket",
        name: "Listen port",
        option: "--port",
        type: "str",
      },
      addr: {
        help: "Address to listen on with UDP socket",
        name: "Listen address",
        option: "--addr",
        type: "str",
      },
      dataset: {
        help: "BigQuery dataset name",
        name: "BQ Dataset",
        option: "--dataset",
        type: "str",
      },
      table: {
        help: "BigQuery table name",
        name: "BQ Table",
        option: "--table",
        type: "str",
      },
    },
    optional: {
      gauth: {
        help: "Google application authentication credentials JSON file path (sets GOOGLE_APPLICATION_CREDENTIALS)",
        name: "Google App Auth credential JSON file path",
        option: "--gauth",
        type: "str",
      },
    },
  };
  process.stdout.write(JSON.stringify(capa) + "\n");
  return 0;
}
if (argv.port) {
  process.env.PORT = argv.port;
}
if (argv.addr) {
  process.env.ADDR = argv.addr;
}
if (argv.dataset) {
  process.env.DATASET = argv.dataset;
}
if (argv.table) {
  process.env.TABLE = argv.table;
}
if (argv.gauth) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = argv.gauth;
}

// Check environment
if (!process.env.PORT) {
  throw new Error("PORT environment variable not set!");
}
if (!process.env.ADDR) {
  throw new Error("ADDR environment variable not set!");
}
if (!process.env.DATASET) {
  throw new Error("DATASET environment variable not set!");
}
if (!process.env.TABLE) {
  throw new Error("TABLE environment variable not set!");
}

// Create listening UDP socket
const s = udp.createSocket("udp4");

s.on("listening", () => {
  const address = s.address();
  console.log(`Waiting for UDP packets on ${address.address}:${address.port}`);
});

s.on("message", (msg, rinfo) => {
  let json = false;
  const date = new Date();
  try {
    json = JSON.parse(msg);
  } catch (e) {
    console.log(`Ignored invalid JSON: ${msg}`);
  }
  // Inject extra user agent info
  if ("user_agent" in json) {
    let ua = uap(json["user_agent"]);
    json["ua"] = {
      result: ua,
      os: ua.os.name,
      engine: ua.engine.name,
      device: ua.device,
    };
  }
  for (const tableName of process.env.TABLE.split(",")) {
    bq.dataset(process.env.DATASET)
      .table(tableName)
      .insert(
        {
          log: JSON.stringify(json),
          id: crypto.randomUUID(),
          timestamp: date.getTime(),
          timestamp_ts: bq.timestamp(date),
        },
        { ignoreUnknownValues: true }
      )
      .catch((e) => {
        console.warn(`${e}`);
        if (e.errors) {
          for (err in e.errors) {
            console.warn(e.errors[err]);
          }
        }
      });
  }
});

s.bind(process.env.PORT, process.env.ADDR);
