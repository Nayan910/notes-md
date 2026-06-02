// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'database.dart';

// **************************************************************************
// DriftDatabaseGenerator
// **************************************************************************

// ignore_for_file: type=lint
class $NotesTable extends Notes
    with TableInfo<$NotesTable, Note> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $NotesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _mtimeMeta = const VerificationMeta('mtime');
  @override
  late final GeneratedColumn<int> mtime = GeneratedColumn<int>(
    'mtime',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sizeMeta = const VerificationMeta('size');
  @override
  late final GeneratedColumn<int> size = GeneratedColumn<int>(
    'size',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _contentMeta = const VerificationMeta(
    'content',
  );
  @override
  late final GeneratedColumn<String> content = GeneratedColumn<String>(
    'content',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _tagsMeta = const VerificationMeta('tags');
  @override
  late final GeneratedColumn<String> tags = GeneratedColumn<String>(
    'tags',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  @override
  List<GeneratedColumn> get $columns => [id, name, mtime, size, content, tags];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'notes';
  @override
  VerificationContext validateIntegrity(
    Insertable<Note> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('mtime')) {
      context.handle(
        _mtimeMeta,
        mtime.isAcceptableOrUnknown(data['mtime']!, _mtimeMeta),
      );
    } else if (isInserting) {
      context.missing(_mtimeMeta);
    }
    if (data.containsKey('size')) {
      context.handle(
        _sizeMeta,
        size.isAcceptableOrUnknown(data['size']!, _sizeMeta),
      );
    }
    if (data.containsKey('content')) {
      context.handle(
        _contentMeta,
        content.isAcceptableOrUnknown(data['content']!, _contentMeta),
      );
    }
    if (data.containsKey('tags')) {
      context.handle(
        _tagsMeta,
        tags.isAcceptableOrUnknown(data['tags']!, _tagsMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Note map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Note(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      mtime: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}mtime'],
      )!,
      size: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}size'],
      )!,
      content: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}content'],
      )!,
      tags: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}tags'],
      )!,
    );
  }

  @override
  $NotesTable createAlias(String alias) {
    return $NotesTable(attachedDatabase, alias);
  }
}

class Note extends DataClass implements Insertable<Note> {
  final String id;
  final String name;
  final int mtime;
  final int size;
  final String content;
  final String tags;
  const Note({
    required this.id,
    required this.name,
    required this.mtime,
    required this.size,
    required this.content,
    required this.tags,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['name'] = Variable<String>(name);
    map['mtime'] = Variable<int>(mtime);
    map['size'] = Variable<int>(size);
    map['content'] = Variable<String>(content);
    map['tags'] = Variable<String>(tags);
    return map;
  }

  NotesCompanion toCompanion(bool nullToAbsent) {
    return NotesCompanion(
      id: Value(id),
      name: Value(name),
      mtime: Value(mtime),
      size: Value(size),
      content: Value(content),
      tags: Value(tags),
    );
  }

  factory Note.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Note(
      id: serializer.fromJson<String>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      mtime: serializer.fromJson<int>(json['mtime']),
      size: serializer.fromJson<int>(json['size']),
      content: serializer.fromJson<String>(json['content']),
      tags: serializer.fromJson<String>(json['tags']),
    );
  }
  factory Note.fromJsonString(
    String encodedJson, {
    ValueSerializer? serializer,
  }) => Note.fromJson(
    DataClass.parseJson(encodedJson) as Map<String, dynamic>,
    serializer: serializer,
  );
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'name': serializer.toJson<String>(name),
      'mtime': serializer.toJson<int>(mtime),
      'size': serializer.toJson<int>(size),
      'content': serializer.toJson<String>(content),
      'tags': serializer.toJson<String>(tags),
    };
  }

  Note copyWith({
    String? id,
    String? name,
    int? mtime,
    int? size,
    String? content,
    String? tags,
  }) => Note(
    id: id ?? this.id,
    name: name ?? this.name,
    mtime: mtime ?? this.mtime,
    size: size ?? this.size,
    content: content ?? this.content,
    tags: tags ?? this.tags,
  );
  Note copyWithCompanion(NotesCompanion data) {
    return Note(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      mtime: data.mtime.present ? data.mtime.value : this.mtime,
      size: data.size.present ? data.size.value : this.size,
      content: data.content.present ? data.content.value : this.content,
      tags: data.tags.present ? data.tags.value : this.tags,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Note(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('mtime: $mtime, ')
          ..write('size: $size, ')
          ..write('content: $content, ')
          ..write('tags: $tags')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, name, mtime, size, content, tags);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Note &&
          other.id == this.id &&
          other.name == this.name &&
          other.mtime == this.mtime &&
          other.size == this.size &&
          other.content == this.content &&
          other.tags == this.tags);
}

class NotesCompanion extends UpdateCompanion<Note> {
  final Value<String> id;
  final Value<String> name;
  final Value<int> mtime;
  final Value<int> size;
  final Value<String> content;
  final Value<String> tags;
  const NotesCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.mtime = const Value.absent(),
    this.size = const Value.absent(),
    this.content = const Value.absent(),
    this.tags = const Value.absent(),
  });
  NotesCompanion.insert({
    required String id,
    required String name,
    required int mtime,
    this.size = const Value.absent(),
    this.content = const Value.absent(),
    this.tags = const Value.absent(),
  })  : id = Value(id),
        name = Value(name),
        mtime = Value(mtime);
  static Insertable<Note> custom({
    Expression<String>? id,
    Expression<String>? name,
    Expression<int>? mtime,
    Expression<int>? size,
    Expression<String>? content,
    Expression<String>? tags,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (mtime != null) 'mtime': mtime,
      if (size != null) 'size': size,
      if (content != null) 'content': content,
      if (tags != null) 'tags': tags,
    });
  }

  NotesCompanion copyWith({
    Value<String>? id,
    Value<String>? name,
    Value<int>? mtime,
    Value<int>? size,
    Value<String>? content,
    Value<String>? tags,
  }) {
    return NotesCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      mtime: mtime ?? this.mtime,
      size: size ?? this.size,
      content: content ?? this.content,
      tags: tags ?? this.tags,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (mtime.present) {
      map['mtime'] = Variable<int>(mtime.value);
    }
    if (size.present) {
      map['size'] = Variable<int>(size.value);
    }
    if (content.present) {
      map['content'] = Variable<String>(content.value);
    }
    if (tags.present) {
      map['tags'] = Variable<String>(tags.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('NotesCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('mtime: $mtime, ')
          ..write('size: $size, ')
          ..write('content: $content, ')
          ..write('tags: $tags')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  late final $NotesTable notes = $NotesTable(this);

  _$AppDatabase(QueryExecutor e) : super(e);

  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();

  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [notes];

  @override
  int get schemaVersion => 1;
}
