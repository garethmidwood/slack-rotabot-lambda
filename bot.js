'use strict';

const promiseDelay = require('promise-delay');
const aws = require('aws-sdk');
const lambda = new aws.Lambda();
const botBuilder = require('claudia-bot-builder');
const slackDelayedReply = botBuilder.slackDelayedReply;
const ApiBuilder = require('claudia-api-builder');
const rota = require('./rota.js');

const api = botBuilder((message, apiRequest) => {
  // Invoke the same Lambda function asynchronously, and do not wait for the response
  // this allows the initial request to end within three seconds, as required by Slack
  return new Promise((resolve, reject) => {
    lambda.invoke({
          FunctionName: apiRequest.lambdaContext.functionName,
          InvocationType: 'Event',
          Payload: JSON.stringify({
            slackEvent: message // this will enable us to detect the event later and filter it
          }),
          Qualifier: apiRequest.lambdaContext.functionVersion
      },
      (err, done) => {
        if (err) return reject(err);
        resolve();
      });
    })
    .then(() => { // empty response to acknowledge
      console.log('sending empty acknowledgement');
      return new ApiBuilder.ApiResponse('', { 'Content-Type': 'text/plain' }, 200);
    })
    .catch(() => {
      return `There was an error running the command`
    });
});

// this will be executed before the normal routing.
// we detect if the event has a flag set by line 18,
// and if so, avoid normal procesing, running a delayed response instead

api.intercept((event) => {
  if (!event.slackEvent) // if this is a normal web request, let it run
    return event;

  console.log('in the intercept');

  // var awesomeCallback = function(message, response) {
  //   console.log('called awesomeCallback with a response of...');
  //   console.log(response);

  //   return slackDelayedReply(message, {
  //     text: `${response}`,
  //     response_type: 'in_channel'
  //   })
  // };

  const message = event.slackEvent;  
  // console.log('passing the message to the rota object');
  // let oRota = new rota(message);

  // oRota.process();

  console.log('passing the message to the rota object');
  let oRota = new rota(message);
  let DDBRequestPromise = oRota.process();

  return Promise.all([DDBRequestPromise]).then(function(values) {
    console.log('promise.all return values:');
    console.log(values);

    return slackDelayedReply(message, {
      text: `${values[0]}`,
      response_type: 'in_channel'
    })
  })
  .then(() => false); // prevent normal execution

  // rotaPromise.then((data) => false); // prevent normal execution
  // console.log(rotaPromise);

  // return rotaPromise;
});

module.exports = api;
