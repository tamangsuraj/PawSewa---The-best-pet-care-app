const asyncHandler = require('express-async-handler');
const { RtcTokenBuilder, RtcRole } = require('agora-token');

function sanitizeChannelName(raw) {
  const s = String(raw || '').trim().slice(0, 64);
  const cleaned = s.replace(/[^a-zA-Z0-9 !#-./:?@[\]^_`{|}~,]/g, '_');
  return cleaned.length > 0 ? cleaned : 'pawsewa_call';
}

function uidFromObjectId(id) {
  const hex = String(id).replace(/\W/g, '').slice(-8) || '1';
  let n = parseInt(hex, 16);
  if (!Number.isFinite(n) || n < 1) n = 1;
  return (n % 2000000000) + 1;
}

/**
 * @route GET /api/v1/calls/token?channelName=...&uid=optional
 * @access Private — JWT
 */
const getRtcToken = asyncHandler(async (req, res) => {
  const channelName = sanitizeChannelName(req.query.channelName);
  let uid = parseInt(String(req.query.uid || ''), 10);
  if (!Number.isFinite(uid) || uid < 1 || uid > 4294967294) {
    uid = uidFromObjectId(req.user._id);
  }

  const appId = (process.env.AGORA_APP_ID || '').trim();
  const cert = (process.env.AGORA_PRIMARY_CERTIFICATE || process.env.AGORA_APP_CERTIFICATE || '').trim();

  if (!appId || !cert) {
    res.status(503);
    throw new Error('Agora is not configured (AGORA_APP_ID / AGORA_PRIMARY_CERTIFICATE).');
  }

  const tokenExpireSec = Math.min(
    Math.max(parseInt(String(req.query.ttl || '3600'), 10) || 3600, 60),
    86400
  );

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    cert,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    tokenExpireSec,
    tokenExpireSec
  );

  res.json({
    success: true,
    data: {
      token,
      uid,
      appId,
      channelName,
      expiresIn: tokenExpireSec,
    },
  });
});

module.exports = { getRtcToken, sanitizeChannelName, uidFromObjectId };
