// DOM helper functions
  export function $(selector, parent = document) {
  return parent.querySelector(selector);
}
export function $all(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}
export function createElement(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
  children.forEach(c => el.append(c));
  return el;
}




// Example in your IoT SaaS:
// Instead of writing:

// document.getElementById('alertsGrid').innerHTML = '';


// You write:

// const grid = $('#alertsGrid');
// grid.innerHTML = '';


// This is cleaner, consistent, and easier to maintain.