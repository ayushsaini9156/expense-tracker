import React, { useState } from "react";
import AuthLayout from "../../components/Layouts/AuthLayout";
import Input from "../../components/Inputs/Input";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { validateEmail } from "../../utils/helper";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [step, setStep] = useState(1); // Step 1: Send OTP, Step 2: Reset Password
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const navigate = useNavigate();

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!validateEmail(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        setError("");
        try {
            await axiosInstance.post(API_PATHS.AUTH.SEND_OTP, { email });
            setStep(2);
        } catch (error) {
            setError(
                error.response?.data?.message || "Failed to send OTP. Try again later."
            );
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();

        if (!otp || !newPassword) {
            setError("Please fill all fields.");
            return;
        }

        setError("");
        try {
            const res = await axiosInstance.post(API_PATHS.AUTH.VERIFY_OTP, {
                email,
                otp,
                newPassword,
            });
            setSuccess("Password changed successfully!");
            setTimeout(() => navigate("/login"), 1500);
        } catch (error) {
            setError(
                error.response?.data?.message || "Failed to reset password. Try again."
            );
        }
    };

    return (
        <AuthLayout>
            <div className="lg:w-[70%] h-3/4 md:h-full flex flex-col justify-center">
                <h3 className="text-xl font-semibold text-black">Forgot Password</h3>
                <p className="text-xs text-slate-700 mt-[5px] mb-6">
                    {step === 1
                        ? "Enter your email to receive an OTP."
                        : "Enter the OTP and set your new password."}
                </p>

                <form onSubmit={step === 1 ? handleSendOtp : handleResetPassword}>
                    <Input
                        value={email}
                        onChange={({ target }) => setEmail(target.value)}
                        label="Email Address"
                        placeholder="your@example.com"
                        type="email"
                        disabled={step === 2}
                    />

                    {step === 2 && (
                        <>
                            <Input
                                value={otp}
                                onChange={({ target }) => setOtp(target.value)}
                                label="OTP"
                                placeholder="Enter OTP"
                                type="text"
                            />

                            <Input
                                value={newPassword}
                                onChange={({ target }) => setNewPassword(target.value)}
                                label="New Password"
                                placeholder="Enter New Password"
                                type="password"
                            />
                        </>
                    )}

                    {error && <p className="text-red-500 text-xs pb-2.5">{error}</p>}
                    {success && (
                        <p className="text-green-600 text-xs pb-2.5">{success}</p>
                    )}

                    <button type="submit" className="btn-primary">
                        {step === 1 ? "Send OTP" : "Reset Password"}
                    </button>
                </form>
            </div>
        </AuthLayout>
    );
};

export default ForgotPassword;
