/* Main script for the Pokédex prototype
   - Uses PokeAPI to load types, location-areas and the full pokemon list.
   - Implements: search by name/id, filter by type/location, clear filter, show all
   - Robert displays selected Pokemon (sprite), name & a small extra info area.
*/
const listEl = document.getElementById("pokemonList");
const searchInput = document.getElementById("searchInput");
const filterBy = document.getElementById("filterBy");
const filterValue = document.getElementById("filterValue");
const clearFilters = document.getElementById("clearFilters");
const orderAsc = document.getElementById("orderAsc");
const orderDesc = document.getElementById("orderDesc");
const gameboyContent = document.getElementById("gameboyContent");
const backToTop = document.getElementById("backToTop");
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const mobileFilters = document.getElementById("mobileFilters");
const mobileFilterBy = document.getElementById("mobileFilterBy");
const mobileFilterValue = document.getElementById("mobileFilterValue");
const mobileOrderAsc = document.getElementById("mobileOrderAsc");
const mobileOrderDesc = document.getElementById("mobileOrderDesc");
const mobileClearFilters = document.getElementById("mobileClearFilters");
const randomPokemonBtn = document.getElementById("randomPokemonBtn");

const typeColor = {
  fire:"#F08030", water:"#6890F0", grass:"#78C850", electric:"#F8D030", ice:"#98D8D8",
  fighting:"#C03028", poison:"#A040A0", ground:"#E0C068", flying:"#A890F0", psychic:"#F85888",
  bug:"#A8B820", rock:"#B8A038", ghost:"#705898", dragon:"#7038F8", dark:"#705848",
  steel:"#B8B8D0", fairy:"#EE99AC", normal:"#A8A878"
};

let allPokemon = []; // {name,url}
let cachedDetails = {}; // name -> detail object
let displayedList = []; // current shown list
let currentFilteredList = []; // current filtered pokemon list
let typesList = [];
let generationsList = [];

// --- helpers ---
function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }
function setGameboyEmpty(){ 
  gameboyContent.innerHTML = `
    <div class="gameboy-card">
      <div style="font-size: 48px; margin-bottom: 16px;">🎮</div>
      <div class="gameboy-name">Selecciona tu Pokémon</div>
      <div class="gameboy-extra">Haz clic en cualquier Pokémon de la lista</div>
    </div>`;
}
function pokeballSVG(){ return `<svg width="120" height="120" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><circle cx="64" cy="64" r="60" fill="#fff" stroke="#222" stroke-width="6"/><path d="M4 64h120" stroke="#222" stroke-width="6"/><circle cx="64" cy="64" r="14" fill="#fff" stroke="#222" stroke-width="4"/></svg>`; }

function showGameboy(poke){ // poke is full detail
  if(!poke){ setGameboyEmpty(); return; }
  const sprite = poke.sprites.front_default || poke.sprites.other?.["official-artwork"]?.front_default || "";
  const types = poke.types.map(t=>t.type.name);
  const ability = poke.abilities[0]?.ability.name.replace('-', ' ') || 'Unknown';
  const height = (poke.height / 10).toFixed(1);
  const weight = (poke.weight / 10).toFixed(1);
  // Clean name for special forms
  const cleanName = poke.name.split('-')[0];
  
  gameboyContent.innerHTML = `
    <div class="gameboy-card">
      <div class="gameboy-sprite"><img src="${sprite}" alt="${cleanName}"></div>
      <div class="gameboy-name">${cleanName}</div>
      <div class="gameboy-types">
        ${types.map(type => `<span class="type-badge type-${type}">${type}</span>`).join("")}
      </div>
      <div class="gameboy-extra">
        <div><strong>Height:</strong> ${height}m</div>
        <div><strong>Weight:</strong> ${weight}kg</div>
        <div><strong>Ability:</strong> ${ability}</div>
      </div>
    </div>`;
    
  // Gameboy is always visible on mobile now
}

function getTypeIcon(type) {
  const typeIcons = {
    fire: "🔥", water: "💧", grass: "🌱", electric: "⚡", ice: "❄️",
    fighting: "👊", poison: "☠️", ground: "🌍", flying: "🕊️", psychic: "🔮",
    bug: "🐛", rock: "🪨", ghost: "👻", dragon: "🐉", dark: "🌙",
    steel: "⚙️", fairy: "🧚", normal: "⭐"
  };
  return typeIcons[type] || "⭐";
}


// --- load helper data ---
async function loadTypes(){
  try{
    const res = await fetch(CONFIG.POKEAPI_BASE + "type");
    const json = await res.json();
    typesList = json.results.filter(t=>t.name !== "unknown" && t.name !== "shadow");
  }catch(e){ console.error("types failed",e); }
}

async function loadGenerations(){
  try{
    const res = await fetch(CONFIG.POKEAPI_BASE + "generation");
    const json = await res.json();
    generationsList = json.results;
  }catch(e){ console.error("generations failed", e); }
}

// --- load global pokemon list (names + urls) ---
async function loadAllPokemon(){
  try{
    const res = await fetch(CONFIG.POKEAPI_BASE + "pokemon?limit=1025&offset=0");
    const json = await res.json();
    // Filter out special forms (gmax, hisui, etc.) - only keep original 1025
    allPokemon = json.results.filter(pokemon => {
      const id = pokemon.url.split('/').slice(-2, -1)[0];
      return parseInt(id) <= 1025 && !pokemon.name.includes('-gmax') && 
             !pokemon.name.includes('-hisui') && !pokemon.name.includes('-alola') &&
             !pokemon.name.includes('-galar') && !pokemon.name.includes('-paldea');
    });
  }catch(e){ console.error("all pokemon failed", e); }
}

// render cards lazily for an array of {name,url}
async function renderList(pokeArray, limit=100){
  listEl.innerHTML = "";
  currentFilteredList = pokeArray; // Store current filtered list
  if(!pokeArray || pokeArray.length===0){ 
    listEl.innerHTML = `
      <div class="no-results">
        <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
        <div style="font-size: 20px; margin-bottom: 8px;">No Pokémon found</div>
        <div style="font-size: 14px; color: #666;">Try adjusting your filters or search terms</div>
      </div>`; 
    return; 
  }
  const slice = pokeArray.slice(0, limit);
  for(const p of slice){
    // get details cached or fetch
    let detail = cachedDetails[p.name];
    if(!detail){
      const r = await fetch(p.url);
      if(!r.ok) continue;
      detail = await r.json();
      cachedDetails[p.name] = detail;
    }
    const li = el("li", "pokemon-card");
    const thumb = el("div","poke-thumb");
    thumb.innerHTML = `<img src="${detail.sprites.front_default}" alt="${detail.name}">`;
    const meta = el("div","poke-meta");
    const formattedId = `#${detail.id.toString().padStart(4, '0')}`;
    const height = (detail.height / 10).toFixed(1);
    const weight = (detail.weight / 10).toFixed(1);
    // Clean name for special forms
    const cleanName = detail.name.split('-')[0];
    meta.innerHTML = `
      <h3>${cleanName}</h3>
      <div class="extra">${formattedId}</div>
      <div class="pokemon-stats">H: ${height}m | W: ${weight}kg</div>
    `;
    const typeDiv = el("div","poke-type");
    // Show all types, not just the primary one
    detail.types.forEach(type => {
      const badge = el("span","badge");
      badge.textContent = type.type.name;
      badge.style.background = typeColor[type.type.name] || "#ddd";
      badge.style.color = "#111";
      badge.style.marginRight = "4px";
      typeDiv.appendChild(badge);
    });
    li.appendChild(thumb); li.appendChild(meta); li.appendChild(typeDiv);
    li.addEventListener("click",()=>{ 
      // Remove previous selection
      document.querySelectorAll('.pokemon-card.selected').forEach(card => {
        card.classList.remove('selected');
      });
      // Add selection to clicked card
      li.classList.add('selected');
      showGameboy(detail); 
      
      // Scroll to top on mobile
      if(window.innerWidth <= 900){
        window.scrollTo({top: 0, behavior: 'smooth'});
      }
    });
    listEl.appendChild(li);
  }
  // if there are more than limit, add a "Load more" button
  if(pokeArray.length > limit){
    const more = el("button");
    more.textContent = `Load more (${pokeArray.length - limit})`;
    more.style.marginTop = "12px";
    more.addEventListener("click", ()=> renderList(pokeArray, limit+40));
    listEl.appendChild(more);
  }
}

// --- Search handler ---
let searchTimer = null;
searchInput.addEventListener("input", (ev)=>{
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=> onSearch(searchInput.value.trim()), 350);
});

async function onSearch(q){
  if(!q){
    // if no query and no active filter, show initial batch
    if(!filterBy.value) return renderList(allPokemon.map(p=>p), CONFIG.MAX_INITIAL_RENDER);
    // otherwise reapply current filter
    return applyFilter();
  }
  try{
    const res = await fetch(CONFIG.POKEAPI_BASE + "pokemon/" + q.toLowerCase());
    if(!res.ok) throw new Error("not found");
    const d = await res.json();
    cachedDetails[d.name] = d;
    renderList([{name:d.name, url: CONFIG.POKEAPI_BASE + "pokemon/" + d.id + "/"}], 1);
    showGameboy(d);
  }catch(err){
    // not found -> show no results AND pokeball on Robert
    listEl.innerHTML = `
      <div class="no-results">
        <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
        <div style="font-size: 20px; margin-bottom: 8px;">No Pokémon found</div>
        <div style="font-size: 14px; color: #666;">Try searching with a different name or ID number</div>
      </div>`;
    setGameboyEmpty();
    // Gameboy stays visible on mobile
    // also set small text on gameboy for clarity
    gameboyContent.innerHTML = `
      <div class="gameboy-card">
        <div style="font-size: 48px; margin-bottom: 16px;">❓</div>
        <div class="gameboy-name">No Pokémon</div>
        <div class="gameboy-extra">Try another name or ID</div>
      </div>`;
  }
}

// --- filters ---
filterBy.addEventListener("change", async ()=> {
  filterValue.innerHTML = "";
  mobileFilterValue.innerHTML = "";
  const mode = filterBy.value;
  if(!mode){ 
    filterValue.innerHTML = `<option value="">-- choose filter --</option>`; 
    mobileFilterValue.innerHTML = `<option value="">-- choose filter --</option>`; 
    filterValue.classList.remove('required');
    mobileFilterValue.classList.remove('required');
    return renderList(allPokemon.map(p=>p), CONFIG.MAX_INITIAL_RENDER); 
  }
  
  // Add required class to indicate second filter is needed
  filterValue.classList.add('required');
  mobileFilterValue.classList.add('required');

  if(mode === "type"){
    // populate types
    filterValue.appendChild(Object.assign(document.createElement("option"), {value:"", textContent:"-- select type --"}));
    mobileFilterValue.appendChild(Object.assign(document.createElement("option"), {value:"", textContent:"-- select type --"}));
    for(const t of typesList){
      const opt = document.createElement("option");
      opt.value = t.name; opt.textContent = t.name;
      filterValue.appendChild(opt);
      const mobileOpt = document.createElement("option");
      mobileOpt.value = t.name; mobileOpt.textContent = t.name;
      mobileFilterValue.appendChild(mobileOpt);
    }
  } else if(mode === "generation"){
    filterValue.appendChild(Object.assign(document.createElement("option"), {value:"", textContent:"-- select generation --"}));
    mobileFilterValue.appendChild(Object.assign(document.createElement("option"), {value:"", textContent:"-- select generation --"}));
    for(const gen of generationsList){
      const opt = document.createElement("option");
      opt.value = gen.url; 
      // Convert generation-i to Generation 1, etc.
      const genNumber = gen.name.split('-').pop();
      const genName = `Generation ${genNumber.toUpperCase()}`;
      opt.textContent = genName;
      filterValue.appendChild(opt);
      const mobileOpt = document.createElement("option");
      mobileOpt.value = gen.url; 
      mobileOpt.textContent = genName;
      mobileFilterValue.appendChild(mobileOpt);
    }
  } else if(mode === "height"){
    filterValue.appendChild(Object.assign(document.createElement("option"), {value:"", textContent:"-- select height range --"}));
    mobileFilterValue.appendChild(Object.assign(document.createElement("option"), {value:"", textContent:"-- select height range --"}));
    const heights = [
      {value: "0-0.5", text: "Very Small (0-0.5m)"},
      {value: "0.5-1", text: "Small (0.5-1m)"},
      {value: "1-2", text: "Medium (1-2m)"},
      {value: "2-5", text: "Large (2-5m)"},
      {value: "5+", text: "Very Large (5m+)"}
    ];
    heights.forEach(height => {
      const opt = document.createElement("option");
      opt.value = height.value; opt.textContent = height.text;
      filterValue.appendChild(opt);
      const mobileOpt = document.createElement("option");
      mobileOpt.value = height.value; mobileOpt.textContent = height.text;
      mobileFilterValue.appendChild(mobileOpt);
    });
  } else if(mode === "weight"){
    filterValue.appendChild(Object.assign(document.createElement("option"), {value:"", textContent:"-- select weight range --"}));
    mobileFilterValue.appendChild(Object.assign(document.createElement("option"), {value:"", textContent:"-- select weight range --"}));
    const weights = [
      {value: "0-10", text: "Very Light (0-10kg)"},
      {value: "10-50", text: "Light (10-50kg)"},
      {value: "50-100", text: "Medium (50-100kg)"},
      {value: "100-500", text: "Heavy (100-500kg)"},
      {value: "500+", text: "Very Heavy (500kg+)"}
    ];
    weights.forEach(weight => {
      const opt = document.createElement("option");
      opt.value = weight.value; opt.textContent = weight.text;
      filterValue.appendChild(opt);
      const mobileOpt = document.createElement("option");
      mobileOpt.value = weight.value; mobileOpt.textContent = weight.text;
      mobileFilterValue.appendChild(mobileOpt);
    });
  } else if(mode === "forms"){
    filterValue.appendChild(Object.assign(document.createElement("option"), {value:"", textContent:"-- select form type --"}));
    mobileFilterValue.appendChild(Object.assign(document.createElement("option"), {value:"", textContent:"-- select form type --"}));
    const forms = [
      {value: "gmax", text: "Gigantamax Forms"},
      {value: "hisui", text: "Hisui Forms"},
      {value: "alola", text: "Alola Forms"},
      {value: "galar", text: "Galar Forms"},
      {value: "paldea", text: "Paldea Forms"}
    ];
    forms.forEach(form => {
      const opt = document.createElement("option");
      opt.value = form.value; opt.textContent = form.text;
      filterValue.appendChild(opt);
      const mobileOpt = document.createElement("option");
      mobileOpt.value = form.value; mobileOpt.textContent = form.text;
      mobileFilterValue.appendChild(mobileOpt);
    });
  }
});

filterValue.addEventListener("change", ()=> {
  if(filterValue.value) {
    filterValue.classList.remove('required');
    mobileFilterValue.classList.remove('required');
  }
  applyFilter();
});

clearFilters.addEventListener("click", ()=>{
  filterBy.value = ""; filterValue.innerHTML = `<option value="">-- choose filter --</option>`;
  filterValue.classList.remove('required');
  mobileFilterValue.classList.remove('required');
  searchInput.value = "";
  renderList(allPokemon.map(p=>p), CONFIG.MAX_INITIAL_RENDER);
  setGameboyEmpty();
  // Gameboy stays visible on mobile
});

orderAsc.addEventListener("click", ()=>{
  if(!currentFilteredList || currentFilteredList.length === 0) return;
  const sortedPokemon = [...currentFilteredList];
  sortedPokemon.sort((a, b) => {
    const idA = parseInt(a.url.split('/').slice(-2, -1)[0]);
    const idB = parseInt(b.url.split('/').slice(-2, -1)[0]);
    return idA - idB;
  });
  renderList(sortedPokemon, CONFIG.MAX_INITIAL_RENDER);
});

orderDesc.addEventListener("click", ()=>{
  if(!currentFilteredList || currentFilteredList.length === 0) return;
  const sortedPokemon = [...currentFilteredList];
  sortedPokemon.sort((a, b) => {
    const idA = parseInt(a.url.split('/').slice(-2, -1)[0]);
    const idB = parseInt(b.url.split('/').slice(-2, -1)[0]);
    return idB - idA;
  });
  renderList(sortedPokemon, CONFIG.MAX_INITIAL_RENDER);
});

// Back to top functionality
backToTop.addEventListener("click", ()=>{
  window.scrollTo({top: 0, behavior: 'smooth'});
});

// Show/hide back to top button based on scroll position
window.addEventListener("scroll", ()=>{
  if(window.scrollY > 300){
    backToTop.classList.add("show");
  } else {
    backToTop.classList.remove("show");
  }
});

// Mobile hamburger menu functionality
mobileMenuToggle.addEventListener("click", ()=>{
  mobileFilters.classList.toggle("show");
});

// Mobile filter functionality (sync with desktop)
mobileFilterBy.addEventListener("change", ()=>{
  filterBy.value = mobileFilterBy.value;
  filterBy.dispatchEvent(new Event('change'));
});

mobileFilterValue.addEventListener("change", ()=>{
  filterValue.value = mobileFilterValue.value;
  filterValue.dispatchEvent(new Event('change'));
});

mobileOrderAsc.addEventListener("click", ()=>{
  if(!currentFilteredList || currentFilteredList.length === 0) return;
  const sortedPokemon = [...currentFilteredList];
  sortedPokemon.sort((a, b) => {
    const idA = parseInt(a.url.split('/').slice(-2, -1)[0]);
    const idB = parseInt(b.url.split('/').slice(-2, -1)[0]);
    return idA - idB;
  });
  renderList(sortedPokemon, CONFIG.MAX_INITIAL_RENDER);
});

mobileOrderDesc.addEventListener("click", ()=>{
  if(!currentFilteredList || currentFilteredList.length === 0) return;
  const sortedPokemon = [...currentFilteredList];
  sortedPokemon.sort((a, b) => {
    const idA = parseInt(a.url.split('/').slice(-2, -1)[0]);
    const idB = parseInt(b.url.split('/').slice(-2, -1)[0]);
    return idB - idA;
  });
  renderList(sortedPokemon, CONFIG.MAX_INITIAL_RENDER);
});

mobileClearFilters.addEventListener("click", ()=>{
  clearFilters.click();
  mobileFilterBy.value = "";
  mobileFilterValue.innerHTML = `<option value="">-- choose filter --</option>`;
});

// Sync mobile filter values when desktop filters change
filterBy.addEventListener("change", ()=>{
  mobileFilterBy.value = filterBy.value;
});

filterValue.addEventListener("change", ()=>{
  mobileFilterValue.value = filterValue.value;
});

// Random Pokémon button functionality
randomPokemonBtn.addEventListener("click", ()=>{
  showRandomInGameboy();
});

async function applyFilter(){
  const mode = filterBy.value;
  const val = filterValue.value;
  if(!mode || !val){ return renderList(allPokemon.map(p=>p), CONFIG.MAX_INITIAL_RENDER); }

  if(mode === "type"){
    // fetch type resource
    try{
      const res = await fetch(val.startsWith("http") ? val : (CONFIG.POKEAPI_BASE + "type/" + val));
      const json = await res.json();
      const pokes = json.pokemon.map(item => item.pokemon).filter(pokemon => {
        const id = parseInt(pokemon.url.split('/').slice(-2, -1)[0]);
        return id >= 1 && id <= 1025 && 
               !pokemon.name.includes('-gmax') && 
               !pokemon.name.includes('-hisui') && 
               !pokemon.name.includes('-alola') &&
               !pokemon.name.includes('-galar') && 
               !pokemon.name.includes('-paldea') &&
               !pokemon.name.includes('-mega') &&
               !pokemon.name.includes('-primal');
      });
      renderList(pokes, 200);
    }catch(e){ console.error("type filter error", e); }
  } else if(mode === "generation"){
    try{
      // val is url of generation resource
      const res = await fetch(val);
      const json = await res.json();
      
      // Get generation number from URL
      const genNumber = val.split('/').slice(-2, -1)[0];
      const genRanges = {
        '1': [1, 151],
        '2': [152, 251], 
        '3': [252, 386],
        '4': [387, 493],
        '5': [494, 649],
        '6': [650, 721],
        '7': [722, 809],
        '8': [810, 905],
        '9': [906, 1025]
      };
      
      const [minId, maxId] = genRanges[genNumber] || [1, 151];
      
      // Filter allPokemon by ID range and exclude special forms
      const pokes = allPokemon.filter(pokemon => {
        const id = parseInt(pokemon.url.split('/').slice(-2, -1)[0]);
        return id >= minId && id <= maxId && 
               !pokemon.name.includes('-gmax') && 
               !pokemon.name.includes('-hisui') && 
               !pokemon.name.includes('-alola') &&
               !pokemon.name.includes('-galar') && 
               !pokemon.name.includes('-paldea') &&
               !pokemon.name.includes('-mega') &&
               !pokemon.name.includes('-primal');
      });
      
      renderList(pokes, 1000); // Show all Pokémon in generation
    }catch(e){ console.error("generation filter error",e); }
  } else if(mode === "height"){
    const filteredPokemon = [];
    for(const pokemon of allPokemon){
      // Skip special forms and ensure ID is within range
      const id = parseInt(pokemon.url.split('/').slice(-2, -1)[0]);
      if(id < 1 || id > 1025 || pokemon.name.includes('-gmax') || pokemon.name.includes('-hisui') || 
         pokemon.name.includes('-alola') || pokemon.name.includes('-galar') || 
         pokemon.name.includes('-paldea') || pokemon.name.includes('-mega') ||
         pokemon.name.includes('-primal')) continue;
         
      try{
        let detail = cachedDetails[pokemon.name];
        if(!detail){
          const res = await fetch(pokemon.url);
          if(!res.ok) continue;
          detail = await res.json();
          cachedDetails[pokemon.name] = detail;
        }
        
        const height = detail.height / 10; // Convert to meters
        const [min, max] = val.split('-').map(Number);
        
        if(val === "5+"){
          if(height >= 5) filteredPokemon.push(pokemon);
        } else if(height >= min && height < max){
          filteredPokemon.push(pokemon);
        }
      }catch(e){ continue; }
    }
    renderList(filteredPokemon, 200);
  } else if(mode === "weight"){
    const filteredPokemon = [];
    for(const pokemon of allPokemon){
      // Skip special forms and ensure ID is within range
      const id = parseInt(pokemon.url.split('/').slice(-2, -1)[0]);
      if(id < 1 || id > 1025 || pokemon.name.includes('-gmax') || pokemon.name.includes('-hisui') || 
         pokemon.name.includes('-alola') || pokemon.name.includes('-galar') || 
         pokemon.name.includes('-paldea') || pokemon.name.includes('-mega') ||
         pokemon.name.includes('-primal')) continue;
         
      try{
        let detail = cachedDetails[pokemon.name];
        if(!detail){
          const res = await fetch(pokemon.url);
          if(!res.ok) continue;
          detail = await res.json();
          cachedDetails[pokemon.name] = detail;
        }
        
        const weight = detail.weight / 10; // Convert to kg
        const [min, max] = val.split('-').map(Number);
        
        if(val === "500+"){
          if(weight >= 500) filteredPokemon.push(pokemon);
        } else if(weight >= min && weight < max){
          filteredPokemon.push(pokemon);
        }
      }catch(e){ continue; }
    }
    renderList(filteredPokemon, 200);
  } else if(mode === "forms"){
    // Load special forms based on selected form type
    try{
      const res = await fetch(CONFIG.POKEAPI_BASE + "pokemon?limit=10000&offset=0");
      const json = await res.json();
      const specialForms = json.results.filter(pokemon => {
        return pokemon.name.includes(`-${val}`);
      });
      renderList(specialForms, 200);
    }catch(e){ console.error("forms filter error",e); }
  }
}

// --- bootstrap ---
async function init(){
  // initial UI state
  gameboyContent.innerHTML = "";
  setGameboyEmpty();
  // load basic lists
  await Promise.all([ loadTypesAndPopulate(), loadGenerationsAndPopulate(), loadAllPokemon() ]);
  // render initial batch
  renderList(allPokemon.map(p=>p), CONFIG.MAX_INITIAL_RENDER);
  // show initial message in Gameboy
  setGameboyEmpty();
}

async function loadTypesAndPopulate(){
  try{
    const res = await fetch(CONFIG.POKEAPI_BASE + "type");
    const json = await res.json();
    typesList = json.results.filter(t=>t.name !== "unknown" && t.name !== "shadow");
  }catch(e){ console.error("loadTypes error",e); }
}

async function loadGenerationsAndPopulate(){
  try{
    const res = await fetch(CONFIG.POKEAPI_BASE + "generation");
    const json = await res.json();
    generationsList = json.results;
  }catch(e){ console.error("loadGen error", e); }
}

async function loadAllPokemon(){
  try{
    const res = await fetch(CONFIG.POKEAPI_BASE + "pokemon?limit=1025&offset=0");
    const json = await res.json();
    // Filter to only include Pokémon 1-1025 and exclude special forms
    allPokemon = json.results.filter(pokemon => {
      const id = parseInt(pokemon.url.split('/').slice(-2, -1)[0]);
      return id >= 1 && id <= 1025 && 
             !pokemon.name.includes('-gmax') && 
             !pokemon.name.includes('-hisui') && 
             !pokemon.name.includes('-alola') &&
             !pokemon.name.includes('-galar') && 
             !pokemon.name.includes('-paldea') &&
             !pokemon.name.includes('-mega') &&
             !pokemon.name.includes('-primal');
    });
  }catch(e){ console.error("load all error", e); }
}

async function showRandomInGameboy(){
  try{
    // Get a random Pokémon from the current filtered list or allPokemon
    const pokemonList = currentFilteredList && currentFilteredList.length > 0 ? currentFilteredList : allPokemon;
    if(!pokemonList || pokemonList.length === 0) return setGameboyEmpty();
    
    const randomIndex = Math.floor(Math.random() * pokemonList.length);
    const randomPokemon = pokemonList[randomIndex];
    
    // Get details
    let detail = cachedDetails[randomPokemon.name];
    if(!detail){
      const res = await fetch(randomPokemon.url);
      if(!res.ok) return setGameboyEmpty();
      detail = await res.json();
      cachedDetails[randomPokemon.name] = detail;
    }
    
    showGameboy(detail);
  }catch(e){ setGameboyEmpty(); }
}

init();
