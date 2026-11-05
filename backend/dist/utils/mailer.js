"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendConfirmationEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
let _transporter = null;
function getTransporter() {
    if (!_transporter) {
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        if (!user || !pass) {
            return null;
        }
        _transporter = nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: { user, pass },
        });
    }
    return _transporter;
}
const sendConfirmationEmail = async (to, code) => {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
        // Si no hay SMTP configurado, registrar advertencia limpia sin exponer detalles sensibles
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Mailer DEV] SMTP no configurado. Código generado para ${to}: ${code}`);
        }
        return false;
    }
    const mailOptions = {
        from: `"JINStock App" <${smtpUser}>`,
        to,
        subject: 'Código de Confirmación - JINStock',
        html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4A148C;">Verifica tu correo electrónico</h2>
        <p>Hola,</p>
        <p>Gracias por registrarte en JINStock. Tu código de verificación es:</p>
        <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 20px 0;">
          ${code}
        </div>
        <p>Ingresa este código en la aplicación para activar tu cuenta.</p>
        <p>Si no solicitaste este registro, ignora este correo.</p>
        <p>Saludos,<br/>Equipo JINStock</p>
      </div>
    `,
    };
    try {
        const transporter = getTransporter();
        if (!transporter)
            return false;
        await transporter.sendMail(mailOptions);
        return true;
    }
    catch (error) {
        console.error(`[Mailer] Error enviando correo a ${to}:`, error.message);
        return false;
    }
};
exports.sendConfirmationEmail = sendConfirmationEmail;
