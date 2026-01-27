
import { ml_dsa44, ml_dsa65, ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';
import { slh_dsa_sha2_128f } from '@noble/post-quantum/slh-dsa.js';

console.log('ML-DSA-44 lengths:', ml_dsa44.lengths);
console.log('ML-DSA-65 lengths:', ml_dsa65.lengths);
console.log('ML-DSA-87 lengths:', ml_dsa87.lengths);
console.log('SLH-DSA-SHA2-128f lengths:', slh_dsa_sha2_128f.lengths);
