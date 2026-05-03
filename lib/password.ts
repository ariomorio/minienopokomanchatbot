// パスワードハッシュ化ユーティリティ
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * パスワードをハッシュ化
 */
export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * パスワードを検証
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
}

/**
 * 管理者用：一時パスワード生成（紛らわしい文字 0/O/1/I/l 除外）
 */
export function generateTemporaryPassword(length = 10): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let pw = '';
    for (let i = 0; i < length; i++) {
        pw += chars[bytes[i] % chars.length];
    }
    if (!/[0-9]/.test(pw)) pw = pw.slice(0, -1) + '7';
    if (!/[a-zA-Z]/.test(pw)) pw = pw.slice(0, -1) + 'A';
    return pw;
}

/**
 * パスワードの強度をチェック
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
        return { valid: false, message: 'パスワードは8文字以上である必要があります' };
    }
    if (password.length > 128) {
        return { valid: false, message: 'パスワードは128文字以下である必要があります' };
    }
    // 少なくとも1つの数字と1つの文字を含む
    if (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password)) {
        return { valid: false, message: 'パスワードは英字と数字を含む必要があります' };
    }
    return { valid: true };
}
