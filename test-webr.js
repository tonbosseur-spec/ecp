import { WebR, ChannelType } from 'webr';

async function testWebR() {
  console.log("Starting WebR init...");
  const webr = new WebR({
    baseUrl: 'https://webr.r-wasm.org/v0.6.0/',
    channelType: ChannelType.PostMessage,
  });
  
  const start = Date.now();
  await webr.init();
  console.log(`Init took ${Date.now() - start}ms`);
  
  const ok = await webr.evalRBoolean('TRUE');
  console.log(`evalRBoolean took ${Date.now() - start}ms, result:`, ok);
  
  webr.close();
}

testWebR().catch(console.error);
