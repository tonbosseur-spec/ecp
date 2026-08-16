import { WebR } from 'webr';
const webr = new WebR();
await webr.init();
const shelter = await new webr.Shelter();
await shelter.captureR('x <- 10', { withAutoprint: true, captureStreams: true, captureConditions: true });
const script = `tryCatch({ 
  .t_res <- suppressWarnings({ x == 10 })
  .ok <- is.logical(.t_res) && length(.t_res) > 0 && all(!is.na(.t_res)) && all(.t_res)
  as.integer(isTRUE(.ok))
}, error = function(e) paste0("ERR:", conditionMessage(e)))`;
const res = await shelter.evalR(script);
const val = await res.toJs();
console.log("val:", val);
await webr.close();
