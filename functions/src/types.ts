import * as admin from 'firebase-admin';

export interface User {
    uid: string;
    email?: string;
    displayName: string;
    role: 'admin' | 'user';
    googleLinked: boolean;
    photoURL?: string;
    createdAt?: admin.firestore.Timestamp;
    lastLogin?: admin.firestore.Timestamp;
}

export interface LoginRequest {
    username: string; // legacy ID
    password: string; // legacy PW
}

export interface LoginResponse {
    customToken: string;
    user: User;
}
