-- PokeStream Connect 0.1. Read-only DS party bridge. No network or game writes.
-- Memory address facts: Real96/PokeLua (see SOURCES.md).
local root = (os.getenv("LOCALAPPDATA") or "") .. "\\PokeStream Connect\\"
local destination = root .. "team.frame"
local profiles = {
 ADAE={4,0x2106FAC,0xD2AC}, APAE={4,0x2106FAC,0xD2AC},
 ADAF={4,0x210712C,0xD2AC}, APAF={4,0x210712C,0xD2AC},
 CPUE={4,0x2101D2C,0xD094}, CPUF={4,0x2101F0C,0xD094},
 IPKE={4,0x211186C,0xD088}, IPGE={4,0x211186C,0xD088},
 IPKF={4,0x211188C,0xD088}, IPGF={4,0x211188C,0xD088},
 IRBO={5,0,0x22349B4}, IRAO={5,0,0x22349D4},
 IRBF={5,0,0x2234934}, IRAF={5,0,0x2234954},
 IREO={5,0,0x221E3EC}, IRDO={5,0,0x221E42C},
 IREF={5,0,0x221E40C}, IRDF={5,0,0x221E42C}
}
local function read32(addr)
 return memory.readbyte(addr)+memory.readbyte(addr+1)*256+memory.readbyte(addr+2)*65536+memory.readbyte(addr+3)*16777216
end
local function tick()
 local code=""
 for i=0,3 do code=code..string.char(memory.readbyte(0x2FFFE0C+i)) end
 local profile=profiles[code]
 if not profile then return end
 local addr=profile[3]
 if profile[1]==4 then
   local pointer=read32(profile[2])
   if pointer<0x2000000 or pointer>0x23EFFFF then return end
   addr=pointer+addr
 end
 local count=memory.readbyte(addr-4)
 local size=profile[1]==4 and 236 or 220
 if count<1 or count>6 or addr<0x2000000 or addr+count*size>0x2400000 then return end
 local lines={"POKESTREAM/1",code,tostring(os.time())}
 for slot=0,count-1 do
   local bytes={}
   for i=0,size-1 do bytes[#bytes+1]=string.format("%02X",memory.readbyte(addr+slot*size+i)) end
   lines[#lines+1]=table.concat(bytes)
 end
 local file=io.open(destination..".tmp","wb")
 if not file then print("Ouvre PokeStream Connect avant de lancer ce script.");return end
 file:write(table.concat(lines,"\n").."\n");file:close()
 os.remove(destination);os.rename(destination..".tmp",destination)
end
print("PokeStream Connect actif. Lance ta partie DS (FR / EN).")
local previous=0
while true do
 local now=os.time()
 if now~=previous then previous=now;local ok,err=pcall(tick);if not ok then print("Connect : "..tostring(err)) end end
 emu.frameadvance()
end
