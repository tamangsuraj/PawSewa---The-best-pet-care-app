const axios = require('axios');

async function testAPI() {
  try {
    // First, login with admin credentials
    console.log('Attempting to login...');
    const loginRes = await axios.post('http://localhost:3000/api/v1/users/login', {
      email: 'admin@pawsewa.com',
      password: 'admin123'
    });

    const token = loginRes.data.data.token;
    const user = loginRes.data.data;
    console.log('✅ Login successful!');
    console.log('User Role:', user.role);
    console.log('Token:', token.substring(0, 20) + '...');

    // Now test the cases endpoint
    console.log('\nAttempting to fetch cases...');
    const casesRes = await axios.get('http://localhost:3000/api/v1/cases', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Cases endpoint successful!');
    console.log('Cases count:', casesRes.data.count);
    console.log('Data:', JSON.stringify(casesRes.data.data, null, 2).substring(0, 500) + '...');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error('Status:', error.response.status);
    }
  }
}

testAPI();
