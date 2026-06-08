import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'trackr-secret-change-me';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '12h' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };
}
