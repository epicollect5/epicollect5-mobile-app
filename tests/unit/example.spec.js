const user = {
  name: 'John Doe',
  age: 22
};

test('test example', () => {
  expect(user.name).toBe('John Doe');
  expect(user.age).toBe(22);
});

test('should work as expected', () => {
  expect(Math.sqrt(4)).toBe(2);
});
