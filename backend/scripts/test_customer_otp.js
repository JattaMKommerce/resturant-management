const axios = require('axios');

async function testCustomerOtp() {
  const BASE_URL = 'http://localhost:5000/api/v1';
  const testPhone = '7795018070';

  console.log('--- TEST 1: Request OTP for', testPhone, '---');
  const sendRes = await axios.post(`${BASE_URL}/auth/customer/send-otp`, {
    phone: testPhone,
    restaurantId: 6
  });
  console.log('Send OTP Response:', sendRes.data);
  const receivedOtp = sendRes.data.otpPreview;
  console.log('Generated OTP Preview:', receivedOtp);

  console.log('\n--- TEST 2: Verify with generated OTP', receivedOtp, '---');
  const verifyRes = await axios.post(`${BASE_URL}/auth/customer/verify-otp`, {
    phone: testPhone,
    otp: receivedOtp,
    restaurantId: 6
  });
  console.log('Verify Status:', verifyRes.status);
  console.log('Verify User:', verifyRes.data.user);
  if (verifyRes.data.user.role !== 'CUSTOMER') {
    throw new Error(`Expected role to be CUSTOMER, got ${verifyRes.data.user.role}`);
  }
  console.log('✅ User authenticated as CUSTOMER successfully!');

  console.log('\n--- TEST 3: Re-verify with same OTP (multi-submit/reload idempotency) ---');
  const reVerifyRes = await axios.post(`${BASE_URL}/auth/customer/verify-otp`, {
    phone: testPhone,
    otp: receivedOtp,
    restaurantId: 6
  });
  console.log('Re-verify Status:', reVerifyRes.status);
  console.log('✅ Re-verification succeeded without invalid or expired error!');

  console.log('\n--- TEST 4: Verify with Universal Master Code (1234) ---');
  const masterRes = await axios.post(`${BASE_URL}/auth/customer/verify-otp`, {
    phone: testPhone,
    otp: '1234',
    restaurantId: 6
  });
  console.log('Master Code Status:', masterRes.status);
  console.log('Master Code User:', masterRes.data.user);
  console.log('✅ Universal Master Code (1234) verified successfully!');
}

testCustomerOtp()
  .then(() => {
    console.log('\n🎉 ALL CUSTOMER OTP TESTS PASSED PERFECTLY!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
  });
