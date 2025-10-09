import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
    console.log('Verifying token for path:', req.path);
    console.log('Cookies received:', req.cookies);
    
    const token = req.cookies.token;
    if(!token){
        console.log('No token found in cookies');
        return res.status(401).json({
            message: "Unauthorized"
        });
    }
    
    // Verify token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token verified successfully for user:', decoded.id);
        
        req.userId = decoded.id;
        req.username = decoded.username;
        next();
    } catch (err) {
        console.error('Token verification failed:', err.message);
        return res.status(403).json({
            message: "Token is not valid"
        });
    }
}