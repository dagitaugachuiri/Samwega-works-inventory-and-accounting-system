
const formatPhoneForDebt = (phone) => {
    if (!phone) return '+254700000000';
    let p = phone.toString().replace(/\s+/g, '');
    if (p.startsWith('+254')) return p;
    if (p.startsWith('254')) return '+' + p;
    if (p.startsWith('0')) return '+254' + p.substring(1);
    return '+254' + p;
};

console.log('0743466032 ->', formatPhoneForDebt('0743466032'));
console.log('254743466032 ->', formatPhoneForDebt('254743466032'));
console.log('+254743466032 ->', formatPhoneForDebt('+254743466032'));
console.log('743466032 ->', formatPhoneForDebt('743466032'));
