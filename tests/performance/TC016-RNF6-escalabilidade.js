import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: __ENV.SHORT_MODE === '1'
    ? [
      { duration: '10s', target: 10 },
      { duration: '10s', target: 25 },
      { duration: '10s', target: 0 }
    ]
    : [
      { duration: '2m', target: 20 },
      { duration: '2m', target: 60 },
      { duration: '2m', target: 120 },
      { duration: '2m', target: 200 },
      { duration: '1m', target: 0 }
    ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate==0']
  }
};

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000';

  const endpoints = ['/zonas', '/api/config', '/dashboard.html'];
  const idx = Math.floor(Math.random() * endpoints.length);
  const response = http.get(`${baseUrl}${endpoints[idx]}`);

  check(response, {
    'sem timeout': r => r.timings.duration < 3000,
    'resposta valida': r => r.status >= 200 && r.status < 500
  });
}
