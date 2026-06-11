import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const latency = new Trend('dashboard_latency');
const serverErrors = new Rate('server_errors');

export const options = {
  vus: __ENV.SHORT_MODE === '1' ? 10 : 50,
  duration: __ENV.SHORT_MODE === '1' ? '20s' : '2m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    server_errors: ['rate<0.01']
  }
};

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000';
  const response = http.get(`${baseUrl}/dashboard.html`);

  latency.add(response.timings.duration);
  serverErrors.add(response.status >= 500);

  check(response, {
    'dashboard respondeu com 2xx': r => r.status >= 200 && r.status < 300,
    'tempo abaixo de 2s': r => r.timings.duration <= 2000,
    'sem erro 5xx': r => r.status < 500
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        p95: data.metrics.http_req_duration.values['p(95)'],
        throughput: data.metrics.http_reqs.values.rate,
        failRate: data.metrics.http_req_failed.values.rate,
        observacao: 'Validar CPU < 80% e memoria < 75% no monitor do host durante o teste.'
      },
      null,
      2
    )
  };
}
