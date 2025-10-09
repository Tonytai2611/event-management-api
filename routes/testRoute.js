/**
 * @route GET /api/test/email-config
 * @desc Check email configuration
 * @access Public
 */
router.get('/email-config', (req, res) => {
    try {
        const emailConfig = {
            username: process.env.EMAIL_USERNAME ? 
                `${process.env.EMAIL_USERNAME.substring(0, 3)}...${process.env.EMAIL_USERNAME.split('@')[1]}` : 'Not configured',
            password: process.env.EMAIL_PASSWORD ? 'Configured' : 'Not configured',
            requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION || 'false'
        };
        
        const isUsernameValid = process.env.EMAIL_USERNAME && 
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.EMAIL_USERNAME);
            
        const validation = {
            username: isUsernameValid ? 'Seems valid' : 'Invalid or not configured',
            password: process.env.EMAIL_PASSWORD ? 'Configured' : 'Not configured'
        };
        
        return res.status(200).json({
            message: 'Current email configuration',
            config: emailConfig,
            validation: validation
        });
    } catch (error) {
        console.error('Error checking email configuration:', error);
        return res.status(500).json({
            error: 'An error occurred while checking email configuration',
            message: error.message
        });
    }
});

/**
 * @route POST /api/test/send-test-email
 * @desc Send test email to check configuration
 * @access Private (admin)
 */
router.post('/send-test-email', verifyToken, async (req, res) => {
    try {
        const { email } = req.body;
        
        // Check admin privileges (optional)
        const user = await User.findById(req.userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'You do not have permission to access this feature' });
        }
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required for testing' });
        }
        
        const result = await nodemailerService.testEmailService(email);
        
        if (result.success) {
            return res.status(200).json({
                message: 'Test email sent successfully',
                result
            });
        } else {
            return res.status(500).json({
                error: 'Unable to send test email',
                details: result
            });
        }
    } catch (error) {
        console.error('Error sending test email:', error);
        return res.status(500).json({
            error: 'An error occurred while sending test email',
            message: error.message
        });
    }
});

/**
 * @route GET /api/test/user-verification/:email
 * @desc Check verification status of a user
 * @access Private (admin)
 */
router.get('/user-verification/:email', verifyToken, async (req, res) => {
    try {
        const { email } = req.params;
        
        // Check admin privileges
        const adminUser = await User.findById(req.userId);
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ error: 'You do not have permission to access this feature' });
        }
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required for verification check' });
        }
        
        const user = await User.findOne({ email }).select('isEmailVerified emailVerificationCode emailVerificationExpires emailVerifiedAt');
        
        if (!user) {
            return res.status(404).json({ error: 'No user found with this email' });
        }
        
        // Check verification status
        const now = new Date();
        const isCodeExpired = user.emailVerificationExpires && user.emailVerificationExpires < now;
        
        return res.status(200).json({
            email: email,
            isVerified: user.isEmailVerified,
            verifiedAt: user.emailVerifiedAt,
            hasVerificationCode: !!user.emailVerificationCode,
            isCodeExpired: isCodeExpired
        });
    } catch (error) {
        console.error('Error checking verification status:', error);
        return res.status(500).json({
            error: 'An error occurred while checking verification status',
            message: error.message
        });
    }
});