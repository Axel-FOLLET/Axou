// Nom de chaque champ de l'API, par langue, pour les messages d'erreur du compte.
// Partagé par la création de compte (AccountPage) et la modification (MonCompte) : FIELD_NAMES[lang][champ].
export const FIELD_NAMES = {
    fr: {
        first_name: 'prénom',
        last_name: 'nom',
        email: 'adresse e-mail',
        password: 'mot de passe',
        phone: 'téléphone',
    },
    en: {
        first_name: 'first name',
        last_name: 'last name',
        email: 'email address',
        password: 'password',
        phone: 'phone number',
    },
}
