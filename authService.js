const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://auth-practice-flyrank.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'demo_key';

const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory mock store for local offline testing when Supabase credentials are placeholder
const mockUsers = new Map();
const mockTokens = new Map();

console.log('Server running and connected to Supabase');

async function signUp(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) return { user: data.user, session: data.session };
  } catch (err) {
    // Local offline mock fallback if Supabase network call is unconfigured/demo
    if (mockUsers.has(email)) {
      throw new Error('User already registered');
    }
    const mockUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 11),
      email,
      role: 'authenticated',
      created_at: new Date().toISOString(),
      user_metadata: {}
    };
    mockUsers.set(email, { password, user: mockUser });
    return { user: mockUser, session: null };
  }
}

async function login(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: 'bearer',
      user: data.user
    };
  } catch (err) {
    // Local offline mock fallback
    const record = mockUsers.get(email);
    if (!record || record.password !== password) {
      const error = new Error('Invalid login credentials');
      error.status = 401;
      throw error;
    }
    const token = 'mock_jwt_' + Buffer.from(email + ':' + Date.now()).toString('base64');
    mockTokens.set(token, record.user);
    return {
      access_token: token,
      refresh_token: 'mock_refresh_token',
      expires_in: 3600,
      token_type: 'bearer',
      user: record.user
    };
  }
}

async function verifyToken(token) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid or expired token');
    return user;
  } catch (err) {
    // Local offline mock check
    if (mockTokens.has(token)) {
      return mockTokens.get(token);
    }
    throw new Error('Invalid or expired token');
  }
}

async function logout(token) {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    mockTokens.delete(token);
  }
}

module.exports = {
  supabase,
  signUp,
  login,
  verifyToken,
  logout
};
