const { arrayMove } = require('@dnd-kit/sortable');
const arr = [{ id: '1' }];
console.log('original:', arr);
const res = arrayMove(arr, 0, -1);
console.log('result:', res);
