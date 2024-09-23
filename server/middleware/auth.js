import jwt from 'jsonwebtoken';
const jwtSecret = process.env.JWT_SECRET;

export function permit(...permittedRoles) {
    return (req, res, next) => {
        const token = req.cookies?.jwt;

        if (token) {
            jwt.verify(token, jwtSecret, (err, decodedToken) => {
                if (err || !permittedRoles.includes(decodedToken.role)) return res.status(401).json({ message: "Not authorized" });

                next();
            });
        } else return res.status(401).json({ message: "Not authorized, token not available" });
    }
};