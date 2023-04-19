#!/bin/node

// Check environment
if (!process.env.PORT){throw new Error("PORT environment variable not set!");}
if (!process.env.ADDR){throw new Error("ADDR environment variable not set!");}
if (!process.env.DATASET){throw new Error("DATASET environment variable not set!");}
if (!process.env.TABLE){throw new Error("TABLE environment variable not set!");}

// Reference to the useragent parser
const uap = require('ua-parser-js');

// BigQuery library
const {BigQuery} = require('@google-cloud/bigquery');
const bq = new BigQuery();

// UDP socket lib
const udp = require('dgram');

// Create listening UDP socket
const s = udp.createSocket('udp4');
s.on('listening', () => {
  const address = s.address();
  console.log(`Waiting for UDP packets on ${address.address}:${address.port}`);
});
s.on('message', (msg, rinfo) => {
  let json = false;
  try{
    json = JSON.parse(msg);
  }catch(e){
    console.log(`Ignored invalid JSON: ${msg}`);
  }
  // Inject extra user agent info
  if ("user_agent" in json){
    let ua = uap(json["user_agent"]);
    json["ua"] = {
      "os": ua.os.name,
      "engine": ua.engine.name,
      "device": ua.device
    };
  }
  console.log(json);
  bq.dataset(process.env.DATASET).table(process.env.TABLE).insert([json]).catch((e) => {
    console.log(`${e}`);
  });
});
s.bind(process.env.PORT, process.env.ADDR);

