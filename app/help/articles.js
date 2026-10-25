/**
 * Centre d'aide : catégories et articles.
 *
 * Chaque article est une liste de blocs simples, rendus par
 * app/help/ArticleBody.jsx. Dans le texte, `[libellé](/adresse)` devient un
 * lien. Tout ce qui est décrit ici doit correspondre au fonctionnement réel
 * du site : à mettre à jour en même temps que le code concerné.
 */

export const CONTACT_EMAIL = "jealife.pictures@gmail.com";

export const CATEGORIES = [
    {
        slug: "telecharger",
        title: "Télécharger et utiliser",
        description: "Formats, licence et images Premium.",
    },
    {
        slug: "publier",
        title: "Publier ses images",
        description: "Envoi, contrôle qualité, modération et gains.",
    },
    {
        slug: "compte",
        title: "Compte et profil",
        description: "Connexion, collections et suppression du compte.",
    },
    {
        slug: "site",
        title: "Utiliser le site",
        description: "Économie de données et signalements.",
    },
];

export const ARTICLES = [
    {
        slug: "telecharger-une-image",
        category: "telecharger",
        title: "Comment télécharger une image en haute résolution ?",
        summary: "Choisir la bonne taille, de 640 px au fichier original.",
        body: [
            { type: "p", text: "Toutes les images gratuites se téléchargent sans compte. Ouvrez l'image qui vous intéresse, puis cliquez sur le bouton « Télécharger » en haut à droite." },
            { type: "h2", text: "Choisir une taille" },
            { type: "p", text: "La flèche à droite du bouton ouvre le choix de la taille :" },
            { type: "ul", items: [
                "Petit : 640 px de large, pour un message ou une présentation.",
                "Moyen : 1 920 px, pour un site web ou les réseaux sociaux.",
                "Grand : 2 400 px, pour un affichage plein écran.",
                "Format original : le fichier d'origine du photographe, pour l'impression.",
            ] },
            { type: "p", text: "Un clic direct sur « Télécharger » donne le format original, sauf si l'économie de données est active : vous recevez alors la taille moyenne, bien plus légère. L'original reste disponible dans le menu des tailles." },
            { type: "h2", text: "Depuis la grille" },
            { type: "p", text: "Sur ordinateur, survolez une image : un bouton de téléchargement apparaît en bas à droite. Sur téléphone, le bouton « Télécharger » se trouve sous chaque image." },
            { type: "h2", text: "Les vidéos" },
            { type: "p", text: "Pour une vidéo, vous avez le choix entre le fichier vidéo d'origine et une image d'aperçu en JPEG." },
            { type: "note", text: "Les images marquées d'un cadenas sont Premium : elles ne se téléchargent pas gratuitement. Voir [Images Premium et crédits](/help/images-premium-et-credits)." },
        ],
    },
    {
        slug: "utiliser-une-image-commercialement",
        category: "telecharger",
        title: "Puis-je utiliser les images pour un projet commercial ?",
        summary: "Oui, gratuitement, avec quelques limites à connaître.",
        body: [
            { type: "p", text: "Oui. Les images gratuites de JEaLiFe Stock peuvent servir à des fins commerciales, sans payer et sans demander d'autorisation." },
            { type: "h2", text: "Ce que vous pouvez faire" },
            { type: "ul", items: [
                "Les utiliser pour une publicité, un site, un emballage, une affiche ou un livre.",
                "Les modifier, les recadrer, les retoucher ou les intégrer à vos créations.",
                "Les publier sur les réseaux sociaux et sur des supports imprimés.",
            ] },
            { type: "h2", text: "Ce qui est interdit" },
            { type: "ul", items: [
                "Revendre ou redistribuer les images telles quelles, ou presque inchangées.",
                "Créer un service concurrent qui propose les mêmes images en téléchargement.",
                "Utiliser une image d'une manière qui porte atteinte aux personnes représentées (diffamation, pornographie, discrimination).",
                "Laisser entendre que le photographe ou JEaLiFe Stock soutient votre produit, votre parti ou votre cause.",
            ] },
            { type: "h2", text: "Les personnes reconnaissables" },
            { type: "p", text: "La licence couvre les droits du photographe, pas ceux des personnes photographiées. Pour un usage commercial où une personne est identifiable, ou pour une marque, un logo ou une œuvre d'art visible, vérifiez qu'une autorisation existe." },
            { type: "note", text: "Le texte complet est sur la page [Licence JEaLiFe](/licence)." },
        ],
    },
    {
        slug: "citer-le-photographe",
        category: "telecharger",
        title: "Dois-je citer le photographe ?",
        summary: "Ce n'est pas obligatoire, mais c'est toujours apprécié.",
        body: [
            { type: "p", text: "Non, la licence ne l'impose pas. Mais une mention fait connaître le travail du photographe et l'encourage à publier davantage." },
            { type: "p", text: "Après chaque téléchargement, une fenêtre vous propose un texte prêt à copier, par exemple :" },
            { type: "quote", text: "Photo de Nom du photographe sur JEaLiFe Stock" },
            { type: "p", text: "Collez-le sous l'image, dans les crédits de votre site ou dans la description de votre publication." },
        ],
    },
    {
        slug: "images-premium-et-credits",
        category: "telecharger",
        title: "Images Premium et crédits",
        summary: "Comment fonctionnent les images marquées d'un cadenas.",
        body: [
            { type: "p", text: "Certains photographes choisissent de proposer une image en Premium. Elle reste visible par tous, avec un filigrane, mais son téléchargement en haute résolution se paie en crédits." },
            { type: "h2", text: "Les crédits" },
            { type: "p", text: "Les crédits s'achètent par lots sur la page [Crédits](/credits), puis se dépensent image par image. Le prix en crédits est affiché sur le bouton de téléchargement de chaque image Premium." },
            { type: "note", text: "Le paiement en ligne n'est pas encore activé. Les images Premium affichent pour l'instant « Bientôt disponible ». L'achat de crédits par Mobile Money arrive prochainement." },
            { type: "h2", text: "Après l'achat" },
            { type: "ul", items: [
                "Vous recevez le fichier original en haute résolution, sans filigrane.",
                "Vous pouvez l'utiliser à vie, pour des projets personnels ou commerciaux.",
                "Vous ne pouvez pas revendre ni redistribuer le fichier d'origine tel quel.",
            ] },
        ],
    },
    {
        slug: "publier-ses-images",
        category: "publier",
        title: "Comment publier ses images ?",
        summary: "Les étapes, les formats acceptés et les limites d'envoi.",
        body: [
            { type: "p", text: "Il faut un compte pour publier. [Créez-en un](/join) gratuitement si ce n'est pas encore fait." },
            { type: "steps", items: [
                "Cliquez sur « Soumettre une image » en haut de la page.",
                "Déposez vos fichiers ou cliquez pour les choisir : jusqu'à 10 à la fois, 50 Mo maximum chacun.",
                "Pour chaque image, décrivez ce que l'on voit, puis ajoutez des mots-clés et le lieu.",
                "Choisissez si l'image est gratuite ou Premium.",
                "Cliquez sur « Publier l'image ».",
            ] },
            { type: "h2", text: "Formats acceptés" },
            { type: "p", text: "JPG, PNG, WebP et SVG pour les images, MP4 pour les vidéos." },
            { type: "h2", text: "Bien décrire son image" },
            { type: "p", text: "La description et les mots-clés servent à la recherche. Une description précise (« Pêcheurs au lever du soleil à Port-Gentil ») fait bien plus voir votre image qu'un titre vague." },
            { type: "note", text: "Avant d'envoyer, vérifiez les [critères de qualité](/help/criteres-de-qualite) : une image qui ne les respecte pas est refusée tout de suite." },
        ],
    },
    {
        slug: "criteres-de-qualite",
        category: "publier",
        title: "Pourquoi mon image a-t-elle été refusée ?",
        summary: "Les contrôles automatiques faits à chaque envoi.",
        body: [
            { type: "p", text: "Chaque image est vérifiée au moment de l'envoi. Si l'un des contrôles échoue, un message vous indique lequel." },
            { type: "h2", text: "Les contrôles" },
            { type: "ul", items: [
                "Résolution : 5 mégapixels minimum (par exemple 2 736 × 1 824 px).",
                "Netteté : une image floue ou mal mise au point est refusée.",
                "Doublon : une image identique ou très proche d'une image déjà publiée est refusée.",
                "Contenu : pas de contenu choquant, violent ou à caractère sexuel.",
                "Pas de filigrane, de logo ou de texte incrusté.",
                "Pas de capture d'écran : seulement des photos et illustrations originales.",
            ] },
            { type: "h2", text: "Vos droits" },
            { type: "p", text: "Ne publiez que des images dont vous êtes l'auteur. Publier l'image de quelqu'un d'autre sans son accord vous expose personnellement." },
        ],
    },
    {
        slug: "moderation",
        category: "publier",
        title: "Mon image est « En cours d'analyse », que se passe-t-il ?",
        summary: "La relecture des envois par l'équipe.",
        body: [
            { type: "p", text: "Selon le réglage choisi par l'équipe, une image qui passe les contrôles automatiques est publiée tout de suite, ou bien relue avant d'apparaître sur le site." },
            { type: "p", text: "Pendant la relecture, l'image porte le badge « En cours d'analyse » sur votre profil. Vous êtes le seul à la voir. Elle apparaît pour tout le monde dès qu'elle est validée." },
            { type: "p", text: "Si elle est refusée, vous recevez un e-mail qui en explique la raison." },
        ],
    },
    {
        slug: "gagner-de-l-argent",
        category: "publier",
        title: "Comment gagner de l'argent avec mes photos ?",
        summary: "Le Premium, votre part sur chaque vente et les versements.",
        body: [
            { type: "p", text: "Au moment de publier, vous pouvez marquer une image comme Premium. Chaque fois qu'un visiteur la télécharge avec des crédits, vous touchez une part de la vente." },
            { type: "ul", items: [
                "Vous choisissez image par image : rien ne devient Premium sans votre accord.",
                "Une image déjà publiée en gratuit le reste.",
                "Certains contributeurs confirmés peuvent fixer eux-mêmes leur prix, dans une fourchette définie par l'équipe.",
            ] },
            { type: "h2", text: "Suivre et recevoir ses gains" },
            { type: "p", text: "L'onglet « Gains » de votre profil affiche votre solde et le détail de chaque vente. Les versements sont faits par l'équipe, par Mobile Money." },
            { type: "note", text: "Le paiement en ligne n'est pas encore activé : les ventes commenceront dès son lancement." },
        ],
    },
    {
        slug: "retirer-une-image",
        category: "publier",
        title: "Comment modifier ou retirer une de mes images ?",
        summary: "Changer la description, ou supprimer l'image du site.",
        body: [
            { type: "steps", items: [
                "Ouvrez votre image.",
                "Cliquez sur « Modifier l'image » en haut de la page.",
                "Changez ce que vous voulez, puis enregistrez. Pour retirer l'image, descendez jusqu'en bas de la page et cliquez sur « J'aimerais supprimer cette image ».",
            ] },
            { type: "p", text: "La suppression retire l'image et ses fichiers du site. Elle ne peut pas annuler les usages déjà faits par les personnes qui l'avaient téléchargée avant." },
        ],
    },
    {
        slug: "creer-un-compte",
        category: "compte",
        title: "Créer un compte et se connecter",
        summary: "Avec Google ou une adresse e-mail.",
        body: [
            { type: "p", text: "Un compte est gratuit. Il sert à publier des images, à aimer des images et à créer des collections. Il n'est pas nécessaire pour télécharger." },
            { type: "p", text: "Sur la page [Créer un compte](/join), inscrivez-vous en un clic avec Google, ou avec votre adresse e-mail et un mot de passe." },
            { type: "h2", text: "Mot de passe oublié" },
            { type: "p", text: "Sur la page de connexion, cliquez sur « Mot de passe oublié ? » et saisissez votre adresse. Vous recevez un e-mail avec un lien pour en choisir un nouveau. Pensez à regarder dans vos courriers indésirables." },
        ],
    },
    {
        slug: "collections-et-favoris",
        category: "compte",
        title: "Garder des images de côté : favoris et collections",
        summary: "Le cœur et le bouton « + ».",
        body: [
            { type: "ul", items: [
                "Le cœur ajoute une image à vos favoris. Vous les retrouvez dans l'onglet « J'aime » de votre profil.",
                "Le bouton « + » range une image dans une collection : choisissez une collection existante ou créez-en une nouvelle sur place.",
            ] },
            { type: "p", text: "Les collections servent à préparer un projet : un dossier de presse, une présentation, l'habillage d'un site. Retrouvez-les dans l'onglet « Collections » de votre profil." },
        ],
    },
    {
        slug: "supprimer-son-compte",
        category: "compte",
        title: "Comment supprimer mon compte ?",
        summary: "La demande se fait par e-mail.",
        body: [
            { type: "p", text: `Écrivez à ${CONTACT_EMAIL} depuis l'adresse liée à votre compte, en précisant votre nom d'utilisateur.` },
            { type: "p", text: "La suppression est réelle : votre profil, vos images et leurs fichiers sont effacés, pas seulement masqués. Elle ne peut pas être annulée." },
        ],
    },
    {
        slug: "economie-de-donnees",
        category: "site",
        title: "Économiser ses données mobiles",
        summary: "Un mode pour les forfaits vendus au mégaoctet.",
        body: [
            { type: "p", text: "L'économie de données réduit ce que le site télécharge, sans rien retirer du catalogue :" },
            { type: "ul", items: [
                "les grandes images s'affichent en version allégée, avec un bouton « Afficher en haute définition » ;",
                "les vidéos ne démarrent plus toutes seules ;",
                "le bouton de téléchargement donne la taille moyenne au lieu de l'original.",
            ] },
            { type: "p", text: "Le réglage se trouve dans le menu (les trois traits). Par défaut, il est en mode automatique : il s'active si votre navigateur signale une connexion lente ou l'économiseur de données. Vous pouvez aussi l'activer ou le désactiver vous-même." },
        ],
    },
    {
        slug: "signaler-une-image",
        category: "site",
        title: "Signaler une image",
        summary: "Contenu choquant, vol d'image, droits non respectés.",
        body: [
            { type: "steps", items: [
                "Ouvrez l'image.",
                "Cliquez sur le bouton « ··· » à côté de « Partager ».",
                "Choisissez « Signaler l'image », puis indiquez la raison.",
            ] },
            { type: "p", text: "Un contenu signalé comme litigieux est retiré le temps de la vérification. Si l'image vous appartient et a été publiée sans votre accord, précisez-le dans votre signalement." },
        ],
    },
];

export function articlesInCategory(slug) {
    return ARTICLES.filter((article) => article.category === slug);
}

export function findArticle(slug) {
    return ARTICLES.find((article) => article.slug === slug) || null;
}

export function categoryOf(article) {
    return CATEGORIES.find((category) => category.slug === article.category);
}
