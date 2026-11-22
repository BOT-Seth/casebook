/**
 * Starter cases — a one-click way to get a usable casebook so the drill loop
 * can be tried in the first minute. Written for this app; the problems are
 * standard interview staples described in my own words.
 */

import type { CaseRow } from '../schemas/cases-schema'

export const STARTER_CASES: Array<Pick<CaseRow, 'title' | 'pattern' | 'difficulty' | 'prompt' | 'approach' | 'complexity' | 'pitfalls' | 'code'>> = [
  {
    title: 'Merge Intervals',
    pattern: 'Sorting + sweep',
    difficulty: 'medium',
    prompt:
      'Given a list of intervals [start, end], merge every overlapping pair and return the non-overlapping intervals that cover the same ranges.',
    approach:
      '1. Sort intervals by start.\n2. Walk them, keeping the last merged interval.\n3. If the current start <= last end, extend last end to max(last end, current end).\n4. Otherwise push the current interval as a new merged one.',
    complexity: 'O(n log n) time for the sort, O(n) extra space for the output.',
    pitfalls:
      'Use max() when extending — a later interval can sit fully inside the last one. Decide whether touching intervals ([1,2],[2,3]) merge; usually they do (<=).',
    code:
      'def merge(intervals):\n    intervals.sort(key=lambda x: x[0])\n    out = []\n    for s, e in intervals:\n        if out and s <= out[-1][1]:\n            out[-1][1] = max(out[-1][1], e)\n        else:\n            out.append([s, e])\n    return out',
  },
  {
    title: 'Two Sum',
    pattern: 'Hash map',
    difficulty: 'easy',
    prompt:
      'Given an array of integers and a target, return the indices of the two numbers that add up to the target. Exactly one answer exists and you may not use the same element twice.',
    approach:
      '1. Keep a map from value to index of numbers seen so far.\n2. For each number x at i, check if target - x is in the map; if so return [map[target - x], i].\n3. Otherwise store x -> i and continue.',
    complexity: 'O(n) time, O(n) space.',
    pitfalls:
      'Check the map before inserting the current number, or [3,3] with target 6 can match an element with itself.',
    code:
      'def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i',
  },
  {
    title: 'Longest Substring Without Repeating Characters',
    pattern: 'Sliding window',
    difficulty: 'medium',
    prompt: 'Given a string, return the length of the longest substring that contains no repeated characters.',
    approach:
      '1. Keep a window [left, right] and a map of each character to its last index.\n2. Move right across the string. If s[right] was seen at an index >= left, jump left to that index + 1.\n3. Record s[right] -> right and update best = max(best, right - left + 1).',
    complexity: 'O(n) time, O(min(n, alphabet)) space.',
    pitfalls:
      'Only move left forward — a stale last-seen index before left must not pull the window back. Empty string returns 0.',
    code:
      'def longest(s):\n    last, left, best = {}, 0, 0\n    for right, ch in enumerate(s):\n        if last.get(ch, -1) >= left:\n            left = last[ch] + 1\n        last[ch] = right\n        best = max(best, right - left + 1)\n    return best',
  },
  {
    title: 'Number of Islands',
    pattern: 'Graph traversal (DFS/BFS)',
    difficulty: 'medium',
    prompt:
      'Given a 2D grid of "1" (land) and "0" (water), count the islands. An island is land connected horizontally or vertically.',
    approach:
      '1. Scan every cell.\n2. When you hit unvisited land, increment the count and flood-fill (DFS or BFS) to mark the whole island visited.\n3. Mark visited by overwriting with "0" or with a visited set.',
    complexity: 'O(rows × cols) time; O(rows × cols) worst-case stack/queue space.',
    pitfalls:
      'Recursive DFS can overflow the stack on a large all-land grid — mention iterative BFS. Diagonals do not connect.',
    code: '',
  },
  {
    title: 'LRU Cache',
    pattern: 'Hash map + doubly linked list',
    difficulty: 'medium',
    prompt:
      'Design a cache with a fixed capacity supporting get(key) and put(key, value) in O(1). When full, put evicts the least recently used key.',
    approach:
      '1. Hash map from key to list node.\n2. Doubly linked list ordered by recency, with sentinel head and tail.\n3. get: move the node to the front and return its value.\n4. put: update and move to front, or insert at front; if over capacity, remove the node before tail and delete its key from the map.',
    complexity: 'O(1) per operation, O(capacity) space.',
    pitfalls:
      'Store the key in the node so eviction can delete it from the map. Updating an existing key also counts as a use. In Python, OrderedDict with move_to_end is acceptable if the interviewer allows it.',
    code: '',
  },
  {
    title: 'Course Schedule',
    pattern: 'Topological sort',
    difficulty: 'medium',
    prompt:
      'There are n courses and a list of prerequisite pairs [a, b] meaning b must be taken before a. Return whether it is possible to finish every course.',
    approach:
      '1. Build an adjacency list b -> a and an in-degree count per course.\n2. Queue every course with in-degree 0 (Kahn\'s algorithm).\n3. Pop, count it as taken, decrement in-degree of its neighbours, queue any that reach 0.\n4. Possible iff the taken count equals n (no cycle).',
    complexity: 'O(V + E) time and space.',
    pitfalls:
      'Courses with no prerequisites still count. A DFS version needs three colours (unvisited / visiting / done) to detect a cycle — two is a bug.',
    code: '',
  },
]
