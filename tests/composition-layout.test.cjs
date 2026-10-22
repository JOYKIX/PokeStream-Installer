const {test} = require('node:test'), assert = require('node:assert/strict');
const load = import('../src/builder/composition-layout.ts');
function check(layout, options) {
  const dual = ['ds','3ds'].includes(options.console);
  assert.equal(layout.filter(e=>e.type==='game-screen').length, dual ? 2 : 1, JSON.stringify(options));
  for (const role of ['camera','chat','team','badges','counter']) assert.equal(layout.some(p=>p.role===role), !!options[role] && (role !== 'badges' || (options.badgeCount ?? 8) > 0), role);
  for (const item of layout) {
    assert.ok(item.x>=0 && item.y>=0 && item.x+item.width<=1920 && item.y+item.height<=1080, JSON.stringify({options,item}));
    assert.ok(item.width>=16 && item.height>=16);
    for (const other of layout) {
      if(item===other)continue;
      const a = ["game-screen","camera","chat"].includes(item.type) ? 14 : 0, b = ["game-screen","camera","chat"].includes(other.type) ? 14 : 0;
      assert.ok(item.x+item.width+a<=other.x-b || other.x+other.width+b<=item.x-a || item.y+item.height+a<=other.y-b || other.y+other.height+b<=item.y-a, JSON.stringify({options,item,other}));
    }
  }
  const main=layout.find(e=>e.role==='main'), ratio=options.console==='gb'||options.console==='gbc'?160/144:options.console==='gba'?1.5:options.console==='3ds'?5/3:options.console==='switch'?16/9:4/3;
  assert.ok(Math.abs(main.width/main.height-ratio)<.02);
  if(dual) {const second=layout.find(e=>e.role==='secondary');assert.ok(options.screens==='side' ? second.x>=main.x+main.width : second.y>=main.y+main.height);}
}
test('all consoles and requested module combinations produce usable, separate placements', async()=>{
  const {compositionLayout, COMPOSITION_CONSOLES}=await load;
  for(const console of COMPOSITION_CONSOLES)for(const screens of ['side','stack'])for(let mask=0;mask<32;mask++) {
    const options={console,screens,camera:!!(mask&1),chat:!!(mask&2),team:!!(mask&4),badges:!!(mask&8),counter:!!(mask&16),badgeColumns:8};
    check(compositionLayout(options),options);
  }
});
test('chosen team and badge grids and measured theme proportions survive crowded compositions', async()=>{
  const {compositionLayout, COMPOSITION_TEAM_LAYOUTS}=await load;
  for(const teamLayout of COMPOSITION_TEAM_LAYOUTS)for(const console of ['ds','3ds','switch'])for(const screens of ['side','stack'])for(const badgeColumns of [8,4,2,1]) {
    const [cols,rows]=teamLayout.split('x').map(Number), measured={team:{width:cols*194+(cols-1)*12,height:rows*290+(rows-1)*12},badges:{[badgeColumns]:{width:badgeColumns*60,height:8/badgeColumns*60}},counter:{width:130,height:58}};
    const options={console,screens,teamLayout,badgeColumns,camera:true,chat:true,team:true,badges:true,counter:true};
    const placements=compositionLayout(options,measured);check(placements,options);
    const team=placements.find(p=>p.role==='team'), badges=placements.find(p=>p.role==='badges');
    assert.ok(Math.abs(team.width/team.height-measured.team.width/measured.team.height)<.03);
    assert.equal(badges.columns,badgeColumns);
    assert.ok(Math.abs(badges.width/badges.height-measured.badges[badgeColumns].width/measured.badges[badgeColumns].height)<.03);
  }
});
test('search is deterministic, adapts to content, handles badge counts and offers distinct alternatives', async()=>{
  const {generateCompositions,compositionLayout,compositionBadgeColumns}=await load;
  const options={console:'ds',screens:'side',camera:true,chat:true,team:true,badges:true,counter:true,teamLayout:'3x2',badgeColumns:4};
  const first=generateCompositions(options);assert.deepEqual(generateCompositions(options),first);assert.ok(first.length>=2);
  const wide=compositionLayout(options,{team:{width:1100,height:250}}), tall=compositionLayout(options,{team:{width:400,height:900}});
  check(wide,options);check(tall,options);assert.notDeepEqual(wide,tall);
  for(const badgeCount of [0,1,8,16,18]) {
    const opts={...options,badgeCount,badgeColumns:'auto'};
    const result=compositionLayout(opts);check(result,opts);
    if(badgeCount)assert.ok(compositionBadgeColumns(badgeCount).includes(result.find(p=>p.role==='badges').columns));
  }
  const game=compositionLayout({...options,focus:'game'}).find(p=>p.role==='main'), balanced=compositionLayout({...options,focus:'balanced'}).find(p=>p.role==='main');
  assert.ok(game.width>=balanced.width,'Game priority must not shrink the main screen');
});
