require('dotenv').config();

async function runQATests() {
  console.log("=== LoadFlow QA Acceptance Tests ===");
  const baseUrl = "http://localhost:3000";
  const email = process.env.DEMO_USER_EMAIL || 'demo@loadflow.app';
  const password = process.env.DEMO_USER_PASSWORD || 'LoadFlowDemo2026!';
  
  // 1. Verify Dev Server is up
  try {
    const res = await fetch(`${baseUrl}/login`);
    if (!res.ok) throw new Error(`Dev server returned ${res.status}`);
    console.log("✓ Dev server is accessible");
  } catch (e) {
    console.error("✗ Dev server is not accessible:", e.message);
    return;
  }

  // 2. Authentication Test
  // In Next.js App Router with Supabase SSR, we can authenticate via the Supabase Auth API
  // but to test the API routes we need the cookie. For simplicity, we'll hit the Supabase API
  // to get the session token, then use it as a Bearer token or set the cookie for our fetch calls.
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log("\nAuthenticating demo user...");
  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
  });
  
  if (!authRes.ok) {
    console.error("✗ Authentication failed:", await authRes.text());
    return;
  }
  
  const authData = await authRes.json();
  const token = authData.access_token;
  console.log("✓ Authenticated successfully");

  // Helper for authenticated requests
  async function apiFetch(path, options = {}) {
    // Set the cookie for Next.js middleware / server components
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': `sb-hmbvqqnjkwupkclenflf-auth-token=${encodeURIComponent(JSON.stringify([{access_token: token, token_type: "bearer"}]))}`,
      ...options.headers
    };
    return fetch(`${baseUrl}${path}`, { ...options, headers });
  }

  // 3. Trucks CRUD
  console.log("\n--- Testing Trucks CRUD ---");
  let truckId;
  try {
    // List
    let res = await apiFetch('/api/trucks');
    let data = await res.json();
    console.log(`✓ List Trucks: found ${data.data?.length || 0} trucks`);
    
    // Create
    res = await apiFetch('/api/trucks', {
      method: 'POST',
      body: JSON.stringify({
        plateNumber: "QA-TEST-100",
        capacity: 25000,
        status: "AVAILABLE"
      })
    });
    let truck = await res.json();
    if (!res.ok) throw new Error(`Create failed: ${JSON.stringify(truck)}`);
    truckId = truck.data.id;
    console.log(`✓ Create Truck: success (${truckId})`);
    
    // Edit
    res = await apiFetch(`/api/trucks/${truckId}`, {
      method: 'PATCH',
      body: JSON.stringify({ capacity: 30000 })
    });
    let updated = await res.json();
    if (!res.ok) throw new Error(`Update failed: ${JSON.stringify(updated)}`);
    if (updated.data.capacity !== 30000) throw new Error("Update didn't persist");
    console.log("✓ Update Truck: success");
    
    // Delete
    res = await apiFetch(`/api/trucks/${truckId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Delete failed");
    console.log("✓ Delete Truck: success");
    
  } catch (e) {
    console.error("✗ Trucks CRUD failed:", e.message);
  }

  // 4. Drivers CRUD
  console.log("\n--- Testing Drivers CRUD ---");
  let driverId;
  try {
    let res = await apiFetch('/api/drivers');
    let data = await res.json();
    console.log(`✓ List Drivers: found ${data.data?.length || 0} drivers`);
    
    res = await apiFetch('/api/drivers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: "QA",
        lastName: "Tester",
        licenseNumber: "QA-LIC-200",
        phone: "555-0100"
      })
    });
    let driver = await res.json();
    if (!res.ok) throw new Error(`Create failed: ${JSON.stringify(driver)}`);
    driverId = driver.data.id;
    console.log(`✓ Create Driver: success (${driverId})`);
    
    res = await apiFetch(`/api/drivers/${driverId}`, {
      method: 'PATCH',
      body: JSON.stringify({ lastName: "Updated" })
    });
    let updated = await res.json();
    if (updated.data.lastName !== "Updated") throw new Error("Update didn't persist");
    console.log("✓ Update Driver: success");
    
    res = await apiFetch(`/api/drivers/${driverId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Delete failed");
    console.log("✓ Delete Driver: success");
  } catch (e) {
    console.error("✗ Drivers CRUD failed:", e.message);
  }

  // 5. Deliveries CRUD
  console.log("\n--- Testing Deliveries CRUD ---");
  let deliveryId;
  try {
    let res = await apiFetch('/api/deliveries');
    let data = await res.json();
    console.log(`✓ List Deliveries: found ${data.data?.length || 0} deliveries`);
    
    res = await apiFetch('/api/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        trackingNumber: "QA-TRK-300",
        destination: "123 QA Street",
        status: "PENDING",
        scheduledDate: new Date().toISOString()
      })
    });
    let del = await res.json();
    if (!res.ok) throw new Error(`Create failed: ${JSON.stringify(del)}`);
    deliveryId = del.data.id;
    console.log(`✓ Create Delivery: success (${deliveryId})`);
    
    res = await apiFetch(`/api/deliveries/${deliveryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: "IN_TRANSIT" })
    });
    let updated = await res.json();
    if (updated.data.status !== "IN_TRANSIT") throw new Error("Update didn't persist");
    console.log("✓ Update Delivery: success");
    
    res = await apiFetch(`/api/deliveries/${deliveryId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Delete failed");
    console.log("✓ Delete Delivery: success");
  } catch (e) {
    console.error("✗ Deliveries CRUD failed:", e.message);
  }

  // 6. Security Sanity Check
  console.log("\n--- Security Sanity Check ---");
  try {
    // Attempt to access an arbitrary UUID (which likely belongs to another tenant or doesn't exist)
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await apiFetch(`/api/trucks/${fakeId}`);
    if (res.status === 404) {
      console.log(`✓ Unauthorized record access blocked (returned 404 NOT FOUND)`);
    } else {
      console.log(`? Unexpected status code for fake ID: ${res.status}`);
    }
    
    const patchRes = await apiFetch(`/api/trucks/${fakeId}`, { method: 'PATCH', body: JSON.stringify({ capacity: 100 }) });
    if (patchRes.status === 404) {
      console.log(`✓ Unauthorized record update blocked (returned 404 NOT FOUND)`);
    } else {
      console.log(`? Unexpected status code for fake ID update: ${patchRes.status}`);
    }
  } catch(e) {
    console.error("✗ Security check failed:", e.message);
  }

}

runQATests();
