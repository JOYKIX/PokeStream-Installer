import {generateCompositions, type CompositionMeasurements, type CompositionOptions} from "./composition-layout";
self.onmessage = (event: MessageEvent<{key: string; options: CompositionOptions; measured: CompositionMeasurements}>) => {
  const {key, options, measured} = event.data;
  try { self.postMessage({key, proposals: generateCompositions(options, measured)}); }
  catch { self.postMessage({key, error: true}); }
};
