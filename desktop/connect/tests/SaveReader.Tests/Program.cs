// SPDX-License-Identifier: GPL-3.0-or-later
// Independent fixture generator: PKHeX's encryption is the oracle for our live decoder.
using PKHeX.Core;
using PokeStream.Connect;
using System.Diagnostics;
using System.Text.Json;
var output=Path.GetFullPath(args.Length>0?args[0]:".artifacts/save-fixtures");Directory.CreateDirectory(output);
int checks=0;void Check(bool value,string label){if(!value)throw new Exception(label);checks++;}
foreach(var version in new[]{GameVersion.RD,GameVersion.YW,GameVersion.GD,GameVersion.C,GameVersion.R,GameVersion.E,GameVersion.FR,GameVersion.D,GameVersion.Pt,GameVersion.HG,GameVersion.B,GameVersion.B2,GameVersion.X,GameVersion.OR,GameVersion.SN,GameVersion.US,GameVersion.GP,GameVersion.SW,GameVersion.SH,GameVersion.BD,GameVersion.PLA,GameVersion.SL,GameVersion.VL}){
    var save=SaveUtil.GetBlankSAV(version,"TEST",LanguageID.French);
    if(save is SAV4){
        var raw=new byte[0x80000];int general=version==GameVersion.D?SAV4DP.GeneralSize:version==GameVersion.Pt?SAV4Pt.GeneralSize:SAV4HGSS.GeneralSize;
        for(int part=0;part<2;part++){
            int at=part*0x40000+general;
            System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(raw.AsSpan(at-12),(uint)general);
            System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(raw.AsSpan(at-8),SAV4.MAGIC_JAPAN_INTL);
        }
        save=version==GameVersion.D?new SAV4DP(raw):version==GameVersion.Pt?new SAV4Pt(raw):new SAV4HGSS(raw);
        save.OT="TEST";save.Language=3;
    }
    var p=save.BlankPKM;
    p.Species=133;p.Nickname="PIXEL";p.IsNicknamed=true;p.OriginalTrainerName="TEST";p.Language=3;p.Version=version;p.TID16=12345;p.SID16=54321;p.EncryptionConstant=0xAB123456;p.PID=0xAB123456;p.CurrentLevel=25;p.Stat_Level=25;p.Stat_HPCurrent=0;p.Stat_HPMax=65;p.RefreshChecksum();
    if(save is SAV7b lg){var f=typeof(PokeListHeader).GetField("PokeListInfo",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance)!;((int[])f.GetValue(lg.Storage)!)[0]=0;lg.Storage.Count=1;}
    save.SetPartySlotAtIndex(p,0,PKMImportSetting.Skip,PKMImportSetting.Skip); if(save.Generation<=2) save.SetBoxSlotAtIndex(p,0,PKMImportSetting.Skip,PKMImportSetting.Skip);
    var file=Path.Combine(output,version+".sav");if(save is SAV_BEEF){int end=save is SAV7b?0xB8800:save.Data.Length; System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(save.Data.AsSpan(end-0x1F0),0x42454546);if(save is SAV7b)System.Buffers.Binary.BinaryPrimitives.WriteUInt16LittleEndian(save.Data.AsSpan(end-0x150),0x13);}
    var expectedBadges=BadgeFixtures.Set(save);
    byte[] exported;
    if(save is SAV3 gba){
        exported=new byte[0x20000];
        for(int group=0;group<2;group++)for(int sector=0;sector<14;sector++){
            int offset=group*0xE000+sector*0x1000;
            System.Buffers.Binary.BinaryPrimitives.WriteUInt16LittleEndian(exported.AsSpan(offset+0xFF4),(ushort)sector);
            System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(exported.AsSpan(offset+0xFF8),0x08012025);
        }
        if(gba is SAV3FRLG)gba.Small[0xAC]=1;
        if(gba is SAV3E){gba.Small[0xAC]=2;gba.Small[0x900]=1;}
        gba.WriteBothSaveSlots(exported);
    }else {
        if(save is ISCBlockArray blocks) foreach(var block in blocks.AllBlocks) if(block.Type==SCTypeCode.None) typeof(SCBlock).GetProperty("Type")!.SetValue(block,block.Data.Length switch {0=>SCTypeCode.Bool1,1=>SCTypeCode.Byte,2=>SCTypeCode.UInt16,4=>SCTypeCode.UInt32,8=>SCTypeCode.UInt64,_=>SCTypeCode.Object});
        exported=save.Write();
    }
    // Blank PKHeX templates omit optional blocks. Add inert synthetic padding to a documented full-save size.
    if(save is ISCBlockArray sc && SaveUtil.GetVariantSAV(exported.ToArray())==null){
        string prefix=save is SAV8SWSH?"SIZE_G8SWSH":save is SAV8LA?"SIZE_G8LA":"SIZE_G9_";
        int target=save is SAV9SV ? (int)((HashSet<long>)typeof(SaveUtil).GetField("SizesSV",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Static)!.GetValue(null)!).Where(n=>n>=exported.Length+9).Min() : typeof(SaveUtil).GetFields(System.Reflection.BindingFlags.Public|System.Reflection.BindingFlags.Static).Where(f=>f.Name.StartsWith(prefix)&&f.FieldType==typeof(int)).Select(f=>(int)f.GetValue(null)!).Where(n=>n>=exported.Length+9).Min();
        var ctor=typeof(SCBlock).GetConstructor(System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance,null,new[]{typeof(uint),typeof(SCTypeCode),typeof(byte[])},null)!;
        var padding=(SCBlock)ctor.Invoke(new object[]{uint.MaxValue,SCTypeCode.Object,new byte[target-exported.Length-9]});
        exported=SwishCrypto.Encrypt(sc.AllBlocks.Append(padding).OrderBy(b=>b.Key).ToArray());
        Check(exported.Length==target,"canonical synthetic size");
    }
    File.WriteAllBytes(file,exported);
    var reloaded=SaveUtil.GetVariantSAV(File.ReadAllBytes(file));
    Check(reloaded is not null && reloaded.ChecksumsValid,version+" checksum");
    var proc=new ProcessStartInfo("dotnet"){RedirectStandardOutput=true,UseShellExecute=false};
    proc.ArgumentList.Add(Path.GetFullPath("tools/SaveReader/bin/Release/net8.0/PokeStream.SaveReader.dll"));proc.ArgumentList.Add(file);
    using var child=Process.Start(proc)!;var result=child.StandardOutput.ReadToEnd();child.WaitForExit();
    Check(child.ExitCode==0,version+" reader: "+result);using var doc=JsonDocument.Parse(result);var member=doc.RootElement.GetProperty("team")[0];
    Check(member.GetProperty("species").GetInt32()==133,version+" species");Check(member.GetProperty("hp").GetInt32()==0,version+" fainted");
    Check(save.Generation<3 ? member.GetProperty("pid").ValueKind==JsonValueKind.Null : member.GetProperty("pid").GetUInt32()==p.PID,version+" stable PID");
    var badges=doc.RootElement.GetProperty("badges");
    Check(expectedBadges==null ? badges.ValueKind==JsonValueKind.Null : badges.EnumerateArray().Select(b=>b.GetInt32()).SequenceEqual(expectedBadges),version+" exact non-linear badges");
    Console.WriteLine(version+": save OK");
}
foreach(int gen in new[]{6,7})foreach(uint shuffle in Enumerable.Range(0,32).Select(x=>(uint)x)){
    PKM p=gen==6?new PK6():new PK7();p.EncryptionConstant=(shuffle<<13)|0x123;p.Species=133;p.Nickname="Évoli";p.IsNicknamed=true;p.Language=3;p.Stat_Level=25;p.Stat_HPCurrent=0;p.Stat_HPMax=65;p.TID16=123;p.SID16=456;p.PID=0xABCD0000|((uint)(123^456)^0xABCD);p.RefreshChecksum();
    var bytes=p.EncryptedPartyData[..254];var result=ModernPartyDecoder.Decode3ds(bytes,gen)!;
    Check(result.Species==133&&result.Nickname=="Évoli"&&result.Level==25&&result.Hp==0&&result.MaxHp==65&&result.Shiny&&result.Pid==p.PID,"3DS shuffle "+shuffle);
    bytes[19]^=1;try{ModernPartyDecoder.Decode3ds(bytes,gen);throw new Exception("Accepted corrupt entity");}catch(InvalidDataException){checks++;}
}
var citraFixture=new PK6{Species=133,EncryptionConstant=12345,Stat_Level=25,Stat_HPCurrent=0,Stat_HPMax=65,Nickname="PIXEL",IsNicknamed=true};citraFixture.RefreshChecksum();File.WriteAllBytes(Path.Combine(output,"party.pk6"),citraFixture.EncryptedPartyData);
foreach(int gen in new[]{1,2})for(ushort species=1;species<=(gen==1?151:251);species++){
    PKM p=gen==1?new PK1():new PK2();p.Species=species;p.Nickname="PIXEL";p.Stat_Level=25;p.Stat_HPCurrent=0;p.Stat_HPMax=65;
    int size=gen==1?44:48;var raw=new byte[8+6*(size+22)];raw[0]=1;raw[1]=p.Data[0];raw[2]=255;p.Data.AsSpan(0,size).CopyTo(raw.AsSpan(8));p.NicknameTrash.CopyTo(raw.AsSpan(8+6*size+66));
    var party=ClassicPartyDecoder.DecodeGb(raw,gen);Check(party.Team[0].Species==species&&party.Team[0].Hp==0&&party.Team[0].Nickname=="PIXEL","GB "+species);
    raw[1]^=1;try{ClassicPartyDecoder.DecodeGb(raw,gen);throw new Exception("Accepted mismatched species list");}catch(InvalidDataException){checks++;}
}
for(ushort species=1;species<=386;species++)for(uint shuffle=0;shuffle<24;shuffle++){
    var p=new PK3{Species=species,PID=shuffle,ID32=12345,Nickname="PIXEL",Stat_Level=25,Stat_HPCurrent=0,Stat_HPMax=65};p.RefreshChecksum();
    var decoded=ClassicPartyDecoder.DecodeGba(p.EncryptedPartyData);Check(decoded.Species==species&&decoded.Hp==0&&decoded.Nickname=="PIXEL"&&decoded.Pid==p.PID,"GBA "+species+" shuffle "+shuffle);
}
foreach(var format in new[]{"PK8","PA8","PK9"})for(ushort species=1;species<=(format=="PK9"?1025:format=="PA8"?905:898);species++)for(uint shuffle=0;shuffle<32;shuffle++) {
    PKM p=format=="PK9"?new PK9():format=="PA8"?new PA8():new PK8();
    p.EncryptionConstant=(shuffle<<13)|0x123;p.Species=species;p.Nickname="Évoli";p.IsNicknamed=true;p.Language=3;p.Stat_Level=25;p.Stat_HPCurrent=0;p.Stat_HPMax=65;p.TID16=123;p.SID16=456;p.PID=0xABCD0000|((uint)(123^456)^0xABCD);p.RefreshChecksum();
    var bytes=p.EncryptedPartyData;var result=ModernPartyDecoder.DecodeSwitch(bytes,format=="PK9"?9:8,format=="PA8")!;
    Check(result.Species==species&&result.Nickname=="Évoli"&&result.Level==25&&result.Hp==0&&result.MaxHp==65&&result.Shiny&&result.Pid==p.PID,"Switch "+format+" "+species+" shuffle "+shuffle);
    if(species==133){bytes[19]^=1;try{ModernPartyDecoder.DecodeSwitch(bytes,format=="PK9"?9:8,format=="PA8");throw new Exception("Accepted corrupt Switch entity");}catch(InvalidDataException){checks++;}}
}
Check(SwitchPartyReader.Find(0x0100ABF008968000,"1.0.0")==null,"Unknown Switch revision rejected");
Check(SwitchPartyReader.Find(0x0100ABF008968001,"1.3.2")==null,"Unknown Switch title rejected");
var switchProfile=SwitchPartyReader.Find(0x0100ABF008968000,"1.3.2")!;
var pk8=new PK8{Species=133,EncryptionConstant=1234,Stat_Level=25,Stat_HPMax=65,Stat_HPCurrent=1};pk8.RefreshChecksum();
File.WriteAllBytes(Path.Combine(output,"party.pk8"),pk8.EncryptedPartyData);
var switchRam=new Dictionary<ulong,byte>();ulong partyAddress=0x100000000+0x450C68B0;
for(int i=0;i<344;i++)switchRam[partyAddress+(ulong)i]=pk8.EncryptedPartyData[i];switchRam[partyAddress+6*344]=1;
byte[] SwitchRead(ulong address,int count)=>Enumerable.Range(0,count).Select(i=>switchRam.GetValueOrDefault(address+(ulong)i)).ToArray();
Check(SwitchPartyReader.Read(switchProfile,0x8000000,0x100000000,SwitchRead).Team[0].Species==133,"SWSH party RAM");
switchRam[partyAddress+6*344]=7;
try{SwitchPartyReader.Read(switchProfile,0x8000000,0x100000000,SwitchRead);throw new Exception("Accepted invalid Switch count");}catch(InvalidDataException){checks++;}
switchRam[partyAddress+6*344]=1;int switchReads=0;
try{SwitchPartyReader.Read(switchProfile,0x8000000,0x100000000,(address,count)=>{var bytes=SwitchRead(address,count);if(address==partyAddress && ++switchReads==2)bytes[0]^=1;return bytes;});throw new Exception("Accepted torn Switch frame");}catch(InvalidDataException){checks++;}
var policy=new ReadingPolicy();var frame=new PartyFrame("kalos",[new(133,"Pixel",25,false,false,1,65)]);var now=DateTimeOffset.UtcNow;
policy.Live(frame,"X",now);Check(policy.Fallback(frame with{Team=[new(25,"",10,false,false,10,20)]},now.AddSeconds(-1),"X")!.Frame.Team[0].Species==133,"No rewind from stale save");
Check(policy.Fallback(frame,now.AddSeconds(1),"X")!.Source==ReadingSource.Save,"New save takes over");
Check(policy.Fallback(frame with{Game="paldea"},now.AddSeconds(2),"Violet")!.Frame.Game=="kalos","No unrelated save takeover");
var gbaHoenn=new PartyFrame("hoenn",frame.Team);policy.Reset();policy.Live(gbaHoenn,"Rubis · Saphir (EN)",now);
Check(policy.Fallback(gbaHoenn,now.AddSeconds(2),"Rubis Oméga · Saphir Alpha")!.Source==ReadingSource.Retained,"Same region is not the same game");
Check(policy.Fallback(null,default,"")!.Frame==gbaHoenn,"Closing emulator retains latest live frame");
Check(GameIdentity.FromName("Citra | Pokémon Rubis Oméga") == "oras","Identify remake before original");
Check(GameIdentity.FromName("Ryujinx | Pokémon Brilliant Diamond v1.3.0") == "bdsp","Identify Switch remake before DS game");
Check(GameIdentity.FromName("Pokémon Ultra Moon") == "usum","Identify Ultra before Moon");
Check(GameIdentity.FromName("Ryujinx") == null,"Emulator name is not a game identity");
Check(!GameIdentity.Supports("Citra","rs"),"Save must belong to selected emulator platform");
Console.WriteLine(checks+" save/live decoder checks passed");

if(args.Contains("--gba-rom")) {
    // Original ARM homebrew fixture. No commercial ROM, BIOS, logo or assets.
    var rom=new byte[0x100000];
    void Word(int at,uint value)=>System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(rom.AsSpan(at),value);
    Word(0,0xEA00002E);System.Text.Encoding.ASCII.GetBytes("CONNECT TESTBPRF00").CopyTo(rom,0xA0);rom[0xB2]=0x96;
    int checksum=0x19;for(int i=0xA0;i<=0xBC;i++)checksum+=rom[i];rom[0xBD]=unchecked((byte)-checksum);
    uint[] arm=[0xE59F0024,0xE3A01001,0xE5C01000,0xE59F001C,0xE59F101C,0xE3A02064,0xE4D13001,0xE4C03001,0xE2522001,0x1AFFFFFB,0xEAFFFFFE,0x02024029,0x02024284,0x08000100];
    for(int i=0;i<arm.Length;i++)Word(0xC0+i*4,arm[i]);
    var mon=new PK3{Species=133,PID=17,ID32=12345,Nickname="PIXEL",Stat_Level=25,Stat_HPCurrent=0,Stat_HPMax=65};mon.RefreshChecksum();mon.EncryptedPartyData.CopyTo(rom,0x100);
    File.WriteAllBytes(Path.Combine(output,"connect-homebrew.gba"),rom);
}
