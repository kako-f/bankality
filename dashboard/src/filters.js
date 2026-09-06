export const filterMovements = (movements, category) => [...movements].reverse().filter((movement) => !category || movement.category.trim() === category.trim())
