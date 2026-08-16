import { WebR } from 'webr';
const webr = new WebR();
await webr.init();
const shelter = await new webr.Shelter();
await shelter.captureR('x <- 10', { withAutoprint: true, captureStreams: true, captureConditions: true });
const res = await shelter.evalR('exists("x", envir = .GlobalEnv)');
const val = await res.toJs();
console.log("exists in .GlobalEnv?", val.values[0]);
await webr.close();
