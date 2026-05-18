import http from 'k6/http';
import { check, sleep } from 'k6';

// Run script: k6 run tests/Load/loadtest.js

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp-up to 20 users
    { duration: '1m', target: 20 },  // Hold load
    { duration: '30s', target: 0 },  // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'], // Goal: 95% of requests under 100ms
  },
};

export default function () {
  // Test the static API /health endpoint for to measure raw container-performance
  const res = http.get('https://planner-studio.azurewebsites.net/up');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}