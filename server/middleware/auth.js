import jwt from 'jsonwebtoken';
const jwtSecret = process.env.JWT_SECRET;

export function permit(...permittedRoles) {
    return (req, res, next) => {
        const token = req.cookies.jwt;

        if (token) {
            jwt.verify(token, jwtSecret, (err, decodedToken) => {
                if (err || !permittedRoles.includes(decodedToken.role)) return res.status(401).json({ message: "Not authorized" });

                next();
            });
        } else return res.status(401).json({ message: "Not authorized, token not available" });
    }
};

export const adminAuth = (req, res, next) => {
    const token = req.cookies.jwt;

    if (token) {
        jwt.verify(token, jwtSecret, (err, decodedToken) => {
            if (err)
                return res.status(401).json({ message: "Not authorized" });

            if (decodedToken.role !== "admin")
                return res.status(401).json({ message: "Not authorized" });

            next();
        });
    } else {
        return res
            .status(401)
            .json({ message: "Not authorized, token not available" });
    }
};

export const userAuth = (req, res, next) => {
    const token = req.cookies.jwt;

    if (token) {
        jwt.verify(token, jwtSecret, (err, decodedToken) => {
            if (err)
                return res.status(401).json({ message: "Not authorized" });

            // check if user role is user or admin
            if (["user", "admin"].includes(decodedToken.role) === false)
                return res.status(401).json({ message: "Not authorized" });

            next();
        });
    } else {
        return res
            .status(401)
            .json({ message: "Not authorized, token not available" });
    }
};