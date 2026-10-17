import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 — compatible S3, remplace Supabase Storage pour les fichiers
 * média. Le navigateur envoie directement vers R2 via une URL signée générée
 * ici : faire transiter un original de 50 Mo par une fonction serverless
 * Vercel se heurterait à sa limite de taille de requête.
 */
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

export const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME;
export const R2_PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").replace(/\/+$/, "");

export const r2Configured = Boolean(
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL
);

export const r2Client = r2Configured
    ? new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })
    : null;

/**
 * URL signée valable 5 minutes pour un PUT direct depuis le navigateur.
 *
 * `contentLength` fait partie de la signature : sans lui, l'URL signée
 * acceptait un corps de n'importe quelle taille. Le plafond de 50 Mo n'existait
 * alors que dans le formulaire, donc côté client — c'est-à-dire nulle part
 * d'opposable. R2 rejette désormais tout envoi dont la taille diffère de
 * celle qui a été signée.
 */
export async function getR2UploadUrl(key, contentType, contentLength) {
    if (!r2Client) throw new Error("Cloudflare R2 n'est pas configuré.");

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
    });

    return getSignedUrl(r2Client, command, {
        expiresIn: 300,
        signableHeaders: new Set(["content-length", "content-type"]),
    });
}

/** URL publique définitive d'un fichier une fois envoyé. */
export function r2PublicUrl(key) {
    return `${R2_PUBLIC_URL}/${key}`;
}

/** Chemin objet R2 à partir d'une URL publique renvoyée par `r2PublicUrl`. */
export function r2KeyFromUrl(url) {
    if (!url || !url.startsWith(`${R2_PUBLIC_URL}/`)) return null;
    return url.slice(R2_PUBLIC_URL.length + 1);
}

/**
 * Supprime un lot d'objets R2, en continuant même si l'un d'eux échoue
 * (fichier déjà absent, etc.) : un seul objet manquant ne doit pas empêcher
 * de nettoyer les autres.
 */
export async function deleteR2Objects(keys) {
    if (!r2Client) throw new Error("Cloudflare R2 n'est pas configuré.");

    const results = await Promise.allSettled(
        keys.filter(Boolean).map((key) =>
            r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
        )
    );

    results.forEach((result, index) => {
        if (result.status === "rejected") {
            console.error(`Échec de suppression R2 pour "${keys[index]}" :`, result.reason);
        }
    });
}

/**
 * Type et taille d'un objet R2, ou `null` s'il n'existe pas. Sert à vérifier
 * côté serveur ce qui a réellement été déposé, plutôt que de croire ce que
 * le navigateur en dit.
 */
export async function headR2Object(key) {
    if (!r2Client) throw new Error("Cloudflare R2 n'est pas configuré.");
    try {
        const head = await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
        return { contentType: head.ContentType || "", size: Number(head.ContentLength) || 0 };
    } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") return null;
        throw error;
    }
}

/**
 * Contenu d'un objet R2, refusé au-delà de `maxBytes`. Lu avec les
 * identifiants du serveur : ne dépend pas du domaine public `r2.dev`,
 * limité en débit.
 */
export async function readR2Object(key, maxBytes) {
    if (!r2Client) throw new Error("Cloudflare R2 n'est pas configuré.");
    const object = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    const size = Number(object.ContentLength) || 0;
    if (maxBytes && size > maxBytes) {
        object.Body?.destroy?.();
        throw new Error(`Objet R2 trop volumineux (${size} octets) : ${key}`);
    }
    const bytes = await object.Body.transformToByteArray();
    return { buffer: Buffer.from(bytes), contentType: object.ContentType || "", size };
}
