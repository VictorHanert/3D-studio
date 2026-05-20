/* global __ENV, __VU, __ITER */

import http from 'k6/http';
import { check, sleep } from 'k6';

// Environment variables: transfer via -e flag to k6
const BASE_URL = __ENV.BASE_URL || 'https://planner-studio.azurewebsites.net';
const USERNAME = __ENV.API_USERNAME || 'test@example.com';
const PASSWORD = __ENV.API_PASSWORD || 'Password12345678_!';

// Session-cookie name: Str::slug(APP_NAME) + '-session'
// APP_NAME=PlannerStudio => 'plannerstudio-session'
const SESSION_COOKIE = __ENV.SESSION_COOKIE || 'plannerstudio-session';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp-up to 20 users
    { duration: '1m', target: 20 },  // Hold load
    { duration: '30s', target: 0 },  // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // Goal: 95% of requests under 500ms
  },
};

// Generate 20 unique modules to simulate the complex load
function generateModules() {
  const models = [];
  for (let i = 0; i < 20; i++) {
    models.push({
      module_key: `CONNECT_MODULAR_SOFA_${i}`,
      path: `models/sofa_${i}.glb`,
      position: { x: i * 1.5, y: 0, z: i * -2.3 },
      rotation: { x: 0, y: 1.5708, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  }
  return models;
}

export function setup() {
  // GET /login to get session-cookie and XSRF-TOKEN from Laravel's web-middleware
  const initRes = http.get(`${BASE_URL}/login`);

  const cookieNames = Object.keys(initRes.cookies);
  console.log(`Cookies received from GET /login: ${JSON.stringify(cookieNames)}`);

  const xsrfRaw = initRes.cookies['XSRF-TOKEN'];
  if (!xsrfRaw || !xsrfRaw[0]) {
    console.error(`Setup error: No XSRF-TOKEN cookie. Status: ${initRes.status}. Cookies: ${JSON.stringify(cookieNames)}`);
    return { authenticated: false };
  }
  const xsrfToken = decodeURIComponent(xsrfRaw[0].value);

  // Extract session-cookie
  const sessionRaw = initRes.cookies[SESSION_COOKIE];
  if (!sessionRaw || !sessionRaw[0]) {
    console.error(`Setup error: No '${SESSION_COOKIE}' cookie. Cookies: ${JSON.stringify(cookieNames)}`);
    return { authenticated: false };
  }

  const cookieHeader = `XSRF-TOKEN=${xsrfRaw[0].value}; ${SESSION_COOKIE}=${sessionRaw[0].value}`;

  // Login via Fortify POST /login
  const loginRes = http.post(`${BASE_URL}/login`, JSON.stringify({
    email: USERNAME,
    password: PASSWORD,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-XSRF-TOKEN': xsrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${BASE_URL}/login`,
      'Cookie': cookieHeader,
    },
  });

  console.log(`Login response status: ${loginRes.status}`);

  const loginOk = [200, 204, 302].includes(loginRes.status);
  if (!loginOk) {
    console.error(`Login failed with status: ${loginRes.status} - ${loginRes.body}`);
    return { authenticated: false };
  }

  // Extract updated cookies after login
  const postLoginSession = loginRes.cookies[SESSION_COOKIE];
  const postLoginXsrf = loginRes.cookies['XSRF-TOKEN'];

  const finalSessionVal = postLoginSession ? postLoginSession[0].value : sessionRaw[0].value;
  const finalXsrfVal = postLoginXsrf ? postLoginXsrf[0].value : xsrfRaw[0].value;

  const authCookie = `XSRF-TOKEN=${finalXsrfVal}; ${SESSION_COOKIE}=${finalSessionVal}`;
  const authXsrf = decodeURIComponent(finalXsrfVal);

  return {
    authenticated: true,
    cookieHeader: authCookie,
    xsrfToken: authXsrf,
  };
}

export default function (data) {
  if (!data.authenticated) {
    console.error('Not authenticated.');
    return;
  }

  // Build payload with unique name per VU and iteration
  const payload = JSON.stringify({
    name: `Loadtest Config VU-${__VU}-ITER-${__ITER}`,
    configuration_data: {
      models: generateModules(),
    },
  });

  // POST to API with the shared session
  const res = http.post(`${BASE_URL}/api/configurations`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-XSRF-TOKEN': data.xsrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': BASE_URL,
      'Cookie': data.cookieHeader,
    },
  });

  check(res, {
    'configuration saved (201)': (r) => r.status === 201,
  });

  sleep(1);
}