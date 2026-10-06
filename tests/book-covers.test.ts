import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { bookCoverPool, pickClosingBooks } from '../docs/.vitepress/theme/components/book-covers.ts'

test('the cover pool contains distinct books with local JPEGs and source metadata', () => {
  assert.ok(bookCoverPool.length >= 36)
  assert.equal(new Set(bookCoverPool.map(book => book.subject)).size, bookCoverPool.length)
  assert.equal(new Set(bookCoverPool.map(book => book.cover)).size, bookCoverPool.length)
  for (const book of bookCoverPool) {
    assert.match(book.subject, /^\d+$/)
    assert.ok(book.title && book.width > 0 && book.height > 0)
    assert.match(book.source, /^https:\/\/img\d\.doubanio\.com\/view\/subject\//)
    const image = readFileSync(new URL(`../docs/public/book-covers/${book.cover}`, import.meta.url))
    assert.equal(image.readUInt16BE(0), 0xffd8)
  }
})

test('selects exactly five or six books at either random boundary', () => {
  assert.equal(pickClosingBooks(() => 0).length, 5)
  assert.equal(pickClosingBooks(() => 0.4999).length, 5)
  assert.equal(pickClosingBooks(() => 0.5).length, 6)
  assert.equal(pickClosingBooks(() => 0.9999).length, 6)
})

test('repeated selections vary without duplicates or mutating the shared pool', () => {
  const before = JSON.stringify(bookCoverPool)
  let seed = 42
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }
  const seen = new Set<string>()
  const counts = new Set<number>()
  const selections = new Set<string>()
  for (let i = 0; i < 200; i++) {
    const books = pickClosingBooks(random)
    assert.ok(books.length === 5 || books.length === 6)
    assert.equal(new Set(books.map(book => book.subject)).size, books.length)
    assert.ok(books.every(book => bookCoverPool.includes(book)))
    books.forEach(book => seen.add(book.subject))
    counts.add(books.length)
    selections.add(books.map(book => book.subject).join(','))
  }
  assert.deepEqual([...counts].sort(), [5, 6])
  assert.equal(seen.size, bookCoverPool.length)
  assert.ok(selections.size > 1)
  assert.equal(JSON.stringify(bookCoverPool), before)
})
