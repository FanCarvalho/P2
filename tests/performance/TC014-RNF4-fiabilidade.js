import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const retries = new Counter('sensor_retries');
const successRate = new Rate('success_rate');

export const options = {
  scenarios: {
    carga_constante: {
      executor: 'constant-arrival-rate',
      rate: __ENV.SHORT_MODE === '1' ? 10 : 100,
      timeUnit: '1s',
      duration: __ENV.SHORT_MODE === '1' ? '30s' : '30m',
      preAllocatedVUs: __ENV.SHORT_MODE === '1' ? 10 : 50,
      maxVUs: __ENV.SHORT_MODE === '1' ? 40 : 200
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.005'],
    success_rate: ['rate>=0.995']
  }
};

function requestComRetry(url, tentativasMax = 3) {
  let ultimo;
  for (let tentativa = 1; tentativa <= tentativasMax; tentativa += 1) {
    ultimo = http.get(url);
    if (ultimo.status < 500) {
      return ultimo;
    }
    retries.add(1);
    sleep(0.2);
  }
  return ultimo;
}

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000';
  const response = requestComRetry(`${baseUrl}/zonas`, 3);

  const ok = check(response, {
    'status 2xx/3xx': r => r.status >= 200 && r.status < 400
  });

  successRate.add(ok);
}

export function handleSummary(data) {
  const retriesCount = data.metrics.sensor_retries?.values?.count ?? 0;
  return {
    stdout: JSON.stringify(
      {
        taxaSucesso: data.metrics.success_rate.values.rate,
        retries: retriesCount,
        nota: 'Para uptime de 72h, executar este script em janela estendida e consolidar logs no observability stack.'
      },
      null,
      2
    )
  };
}
