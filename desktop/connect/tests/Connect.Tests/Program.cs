using PokeStream.Connect;
using System.Buffers.Binary;
using MoonSharp.Interpreter;
int passed=0;
void Check(bool ok,string name){if(!ok)throw new Exception(name);passed++;}
void Reject(Action action,string name){try{action();}catch(InvalidDataException){passed++;return;}throw new Exception(name);}
// Logical block -> physical block positions, independently listed from PK4 format references.
int[][] order=[[0,1,2,3],[0,1,3,2],[0,2,1,3],[0,3,1,2],[0,2,3,1],[0,3,2,1],[1,0,2,3],[1,0,3,2],[2,0,1,3],[3,0,1,2],[2,0,3,1],[3,0,2,1],[1,2,0,3],[1,3,0,2],[2,1,0,3],[3,1,0,2],[2,3,0,1],[3,2,0,1],[1,2,3,0],[1,3,2,0],[2,1,3,0],[3,1,2,0],[2,3,1,0],[3,2,1,0]];
void W16(byte[] b,int i,int v)=>BinaryPrimitives.WriteUInt16LittleEndian(b.AsSpan(i),(ushort)v);
void W32(byte[] b,int i,uint v)=>BinaryPrimitives.WriteUInt32LittleEndian(b.AsSpan(i),v);
byte[] Fixture(int gen,int permutation,bool egg=false,bool shiny=true){
 var b=new byte[gen==4?236:220];uint pid=(uint)(permutation<<13)|17;
 W32(b,0,pid);W16(b,8,133);W16(b,0xC,123);W16(b,0xE,(int)((pid>>16)^(pid&65535)^123^(shiny?0:80)));
 W32(b,0x38,0x80000000|(egg?0x40000000u:0));b[0x8C]=25;W16(b,0x8E,0);W16(b,0x90,65);
 string nick="Pixel";for(int j=0;j<nick.Length;j++)W16(b,0x48+j*2,gen==5?nick[j]:char.IsUpper(nick[j])?0x12B+nick[j]-'A':0x145+nick[j]-'a');W16(b,0x48+nick.Length*2,0xffff);
 int checksum=0;for(int j=8;j<136;j+=2)checksum+=BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(j));W16(b,6,checksum);
 var encoded=(byte[])b.Clone();for(int block=0;block<4;block++)Array.Copy(b,8+block*32,encoded,8+order[permutation%24][block]*32,32);
 void Encrypt(int start,int end,uint seed){for(int i=start;i<end;i+=2){seed=(uint)(((ulong)seed*1103515245+24691)&0xffffffff);W16(encoded,i,BinaryPrimitives.ReadUInt16LittleEndian(encoded.AsSpan(i))^(int)(seed/65536));}}
 Encrypt(8,136,(ushort)checksum);Encrypt(136,encoded.Length,pid);return encoded;
}
for(int gen=4;gen<=5;gen++)for(int n=0;n<32;n++){var p=PartyDecoder.Decode(Fixture(gen,n),gen);Check(p==new PartyMember(133,"Pixel",25,true,false,0,65,(uint)(n<<13)|17),$"gen {gen} shuffle {n}");}
Check(PartyDecoder.Decode(Fixture(4,10,true,false),4) is {Egg:true,Shiny:false},"egg and nonshiny");
var damaged=Fixture(5,12);damaged[77]^=255;Reject(()=>PartyDecoder.Decode(damaged,5),"checksum");Reject(()=>PartyDecoder.Decode(new byte[200],4),"size");
var transient=Fixture(4,0);PartyDecoder.Crypt(transient.AsSpan(8,128),BinaryPrimitives.ReadUInt16LittleEndian(transient.AsSpan(6)));PartyDecoder.Crypt(transient.AsSpan(136),BinaryPrimitives.ReadUInt32LittleEndian(transient));Reject(()=>PartyDecoder.Decode(transient,4),"transient plaintext must never be interpreted as stable shuffled data");
string Frame(string code,int gen)=>"POKESTREAM/1\n"+code+"\n"+DateTimeOffset.UtcNow.ToUnixTimeSeconds()+"\n"+Convert.ToHexString(Fixture(gen,23))+"\n";
Check(PartyDecoder.ParseFrame(Frame("CPUF",4),DateTimeOffset.UtcNow).Game=="sinnoh","French Platinum");Check(PartyDecoder.ParseFrame(Frame("IRBO",5),DateTimeOffset.UtcNow).Game=="unova","English Black");
Reject(()=>PartyDecoder.ParseFrame(Frame("IRBO",5),DateTimeOffset.UtcNow.AddMinutes(1)),"stale");Reject(()=>PartyDecoder.ParseFrame(Frame("ZZZF",5),DateTimeOffset.UtcNow),"unknown game");
// Execute the shipped Lua script against a mocked read-only emulator, for every profile.
var profiles=new (string Code,int Gen,int Pointer,int Address)[]{("ADAE",4,0x2106FAC,0xD2AC),("APAE",4,0x2106FAC,0xD2AC),("ADAF",4,0x210712C,0xD2AC),("APAF",4,0x210712C,0xD2AC),("CPUE",4,0x2101D2C,0xD094),("CPUF",4,0x2101F0C,0xD094),("IPKE",4,0x211186C,0xD088),("IPGE",4,0x211186C,0xD088),("IPKF",4,0x211188C,0xD088),("IPGF",4,0x211188C,0xD088),("IRBO",5,0,0x22349B4),("IRAO",5,0,0x22349D4),("IRBF",5,0,0x2234934),("IRAF",5,0,0x2234954),("IREO",5,0,0x221E3EC),("IRDO",5,0,0x221E42C),("IREF",5,0,0x221E40C),("IRDF",5,0,0x221E42C)};
string root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../"));
string temp=Path.Combine(root,".artifacts","lua-test");Directory.CreateDirectory(Path.Combine(temp,"PokeStream Connect"));
foreach(var profile in profiles){
 var memory=new Dictionary<int,byte>();for(int i=0;i<4;i++)memory[0x2FFFE0C+i]=(byte)profile.Code[i];
 int address=profile.Address;if(profile.Pointer!=0){int pointer=0x2200000;for(int i=0;i<4;i++)memory[profile.Pointer+i]=(byte)(pointer>>(8*i));address+=pointer;}
 memory[address-4]=1;var bytes=Fixture(profile.Gen,17);for(int i=0;i<bytes.Length;i++)memory[address+i]=bytes[i];
 var lua=new Script(CoreModules.Preset_Complete);var mem=new Table(lua);mem["readbyte"]=(Func<double,double>)(a=>memory.GetValueOrDefault((int)a));lua.Globals["memory"]=mem;
 var emu=new Table(lua);emu["frameadvance"]=(Action)(()=>throw new InvalidOperationException("test_complete"));lua.Globals["emu"]=emu;lua.Globals.Get("os").Table["getenv"]=(Func<string,string>)(_=>temp);lua.Globals.Get("os").Table["time"]=(Func<double>)(()=>DateTimeOffset.UtcNow.ToUnixTimeSeconds());lua.Options.DebugPrint=_=>{};
 try{lua.DoFile(Path.Combine(root,"bridge","pokestream-desmume.lua"));}catch(Exception e) when(e.ToString().Contains("test_complete")){}
 var text=File.ReadAllText(Path.Combine(temp,"PokeStream Connect","team.frame"));Check(PartyDecoder.ParseFrame(text,DateTimeOffset.UtcNow).Team[0].Species==133,"Lua "+profile.Code);
}

// Read direct RAM with sparse fixtures independent of the production profile table.
foreach(var profile in profiles) {
 var data=new Dictionary<uint,byte>();uint address=(uint)profile.Address;
 if(profile.Pointer!=0) {uint pointer=0x02200000;var pointerBytes=BitConverter.GetBytes(pointer);for(int i=0;i<4;i++)data[(uint)profile.Pointer+(uint)i]=pointerBytes[i];address+=pointer;}
 data[address-4]=2;
 for(int slot=0;slot<2;slot++){var bytes=Fixture(profile.Gen,slot==0?17:9);for(int i=0;i<bytes.Length;i++)data[address+(uint)(slot*bytes.Length+i)]=bytes[i];}
 byte[] Read(uint a,int n)=>Enumerable.Range(0,n).Select(i=>data.GetValueOrDefault(a+(uint)i)).ToArray();
 var config=GameProfiles.All.Single(p=>p.Code==profile.Code);
 Check(DsPartyReader.Read(config,Read).Team.Length==2,"direct RAM "+profile.Code);
 data[address-4]=7;Reject(()=>DsPartyReader.Read(config,Read),"invalid count "+profile.Code);data[address-4]=2;
 int reads=0;Reject(()=>DsPartyReader.Read(config,(a,n)=>{var bytes=Read(a,n);if(a==address && ++reads==2)bytes[0]^=1;return bytes;}),"changing frame "+profile.Code);
 data[address-4]=0;Reject(()=>DsPartyReader.Read(config,Read),"no starter "+profile.Code);
}
var header=new byte[64];System.Text.Encoding.ASCII.GetBytes("IRBF").CopyTo(header,12);
Check(GameProfiles.FindHeaders(header,header.Length,0).Single().Profile.Code=="IRBF","RAM header location");
var shifted=new byte[68];header.CopyTo(shifted,4);Check(GameProfiles.FindHeaders(shifted,shifted.Length,0).Single().Offset==16,"32-bit RAM alignment");
Check(GameProfiles.FindHeaders(System.Text.Encoding.ASCII.GetBytes("IRBF"),4,0).Single().Profile.Code=="IRBF","header on a memory chunk boundary");
header[18]=255;Check(!GameProfiles.FindHeaders(header,header.Length,0).Any(),"non-DS header rejected");
Reject(()=>DsPartyReader.Read(GameProfiles.All[0],(_,n)=>new byte[n]),"uninitialised indirect pointer");
if(args.Length==2 && args[0]=="--rom") {
 // Original homebrew: copy a synthetic PK5 fixture into DS RAM, then loop forever.
 // No Nintendo logo, game code, assets, BIOS, or commercial ROM data is included.
 // IRBF is only the four-byte identifier understood by the reader under test.
 var rom=new byte[0x10000];System.Text.Encoding.ASCII.GetBytes("CONNECT TEST").CopyTo(rom,0);
 System.Text.Encoding.ASCII.GetBytes("IRBF00").CopyTo(rom,12);
 W32(rom,0x20,0x200);W32(rom,0x24,0x02000000);W32(rom,0x28,0x02000000);W32(rom,0x2C,268);
 W32(rom,0x30,0x400);W32(rom,0x34,0x03800000);W32(rom,0x38,0x03800000);W32(rom,0x3C,4);
 W32(rom,0x80,(uint)rom.Length);W32(rom,0x84,0x200);W32(rom,0x400,0xEAFFFFFE);
 uint[] arm9=[0xE59F0018,0xE59F1018,0xE59F2018,0xE4D13001,0xE4C03001,0xE2522001,0x1AFFFFFB,0xEAFFFFFE,0x02234930,0x0200002C,224];
 for(int i=0;i<arm9.Length;i++)W32(rom,0x200+i*4,arm9[i]);
 rom[0x22C]=1;Fixture(5,17).CopyTo(rom,0x230);
 ushort Crc(int start,int length){ushort crc=0xFFFF;for(int i=start;i<start+length;i++){crc^=rom[i];for(int b=0;b<8;b++)crc=(ushort)((crc>>1)^((crc&1)!=0?0xA001:0));}return crc;}
 W16(rom,0x15C,Crc(0xC0,156));W16(rom,0x15E,Crc(0,0x15E));
 Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(args[1]))!);File.WriteAllBytes(args[1],rom);
}
AutomationChecks.Run(Check);
Console.WriteLine($"PASS {passed} checks: PK4/PK5 permutations, checksum, eggs, freshness, 18 Lua and direct RAM profiles, torn frames and RAM headers.");
