import { After, setDefaultTimeout, Status } from '@cucumber/cucumber';
import { config } from './config.js';

setDefaultTimeout(config.stepTimeoutMs);

After(async function ({ result }) {
  // On failure, put the last request/response in the report before cleanup sends more requests.
  if (result?.status === Status.FAILED && this.response) {
    const exchange = this.describeExchange();
    this.attach(JSON.stringify(exchange, null, 2), 'application/json');
    this.log(`Last request: ${exchange.request.method} ${exchange.request.url}\nResponse ${exchange.response.status}: ${JSON.stringify(exchange.response.body)?.slice(0, 1000)}`);
  }

  // Cleanup requests registered with "after the scenario, I send ..." run last-in, first-out,
  // whether the scenario passed or not. A failed cleanup is logged, not raised; a 404 means
  // the scenario already removed the resource and is ignored.
  for (const cleanup of this.cleanups.reverse()) {
    try {
      this.identities = cleanup.identities;
      const response = await this.send({ ...cleanup.request, record: false });
      if (response.status >= 400 && response.status !== 404) {
        this.log(`Cleanup ${cleanup.request.method} ${cleanup.request.path} returned ${response.status}: ${response.text.slice(0, 300)}`);
      }
    } catch (err) {
      this.log(`Cleanup ${cleanup.request.method} ${cleanup.request.path} failed: ${err.message}`);
    }
  }
});
