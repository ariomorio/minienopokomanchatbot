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
